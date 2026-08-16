-- 1) New users start at 10 trust points
ALTER TABLE public.users ALTER COLUMN trust_score SET DEFAULT 10;

-- 2) Deterministic helpers -------------------------------------------------

-- numeric code for a status: 2 available, 1 low, 0 out, NULL unknown
CREATE OR REPLACE FUNCTION public.status_code(_status public.mookrob_status)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _status WHEN 'available' THEN 2 WHEN 'low' THEN 1 WHEN 'out' THEN 0 ELSE NULL END;
$$;

-- start of the current business day for a restaurant (Asia/Bangkok)
CREATE OR REPLACE FUNCTION public.business_day_start(_open_time time)
RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  _local timestamp := (now() AT TIME ZONE 'Asia/Bangkok');
  _start timestamptz;
BEGIN
  _start := ((_local::date + _open_time) AT TIME ZONE 'Asia/Bangkok');
  IF now() < _start THEN
    _start := (((_local::date - 1) + _open_time) AT TIME ZONE 'Asia/Bangkok');
  END IF;
  RETURN _start;
END;
$$;

-- a report older than 3 hours (or from a previous business day) is expired
CREATE OR REPLACE FUNCTION public.is_report_expired(_created_at timestamptz, _open_time time)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT _created_at < GREATEST(now() - interval '3 hours', public.business_day_start(_open_time));
$$;

-- weight of a single report: trust x recency x GPS quality
CREATE OR REPLACE FUNCTION public.report_weight(
  _trust_score integer,
  _created_at timestamptz,
  _distance_meters integer
)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT round(
    (GREATEST(LEAST(COALESCE(_trust_score, 10), 100), 0)::numeric)
    * CASE
        WHEN now() - _created_at <= interval '60 minutes' THEN 1.0
        WHEN now() - _created_at <= interval '3 hours' THEN 0.5
        ELSE 0.0
      END
    * CASE
        WHEN _distance_meters IS NULL THEN 0.5
        WHEN _distance_meters <= 100 THEN 1.0
        WHEN _distance_meters <= 300 THEN 0.6
        ELSE 0.3
      END
  , 4);
$$;

-- 3) Weighted consensus + confidence --------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_restaurant_status(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _open time;
  _window_start timestamptz;
  _best public.mookrob_status := 'unknown';
  _best_weight numeric := 0;
  _total_weight numeric := 0;
  _count integer := 0;
  _avg_trust numeric := 10;
  _fresh integer := 0;
  _last timestamptz;
  _agreement numeric := 0;
  _volume numeric := 0;
  _trust_factor numeric := 0;
  _recency numeric := 0;
  _confidence integer := 0;
BEGIN
  SELECT open_time INTO _open FROM public.restaurants WHERE id = _restaurant_id;
  IF _open IS NULL THEN
    RETURN;
  END IF;

  _window_start := GREATEST(now() - interval '3 hours', public.business_day_start(_open));

  WITH recent AS (
    SELECT r.reported_status,
           r.created_at,
           u.trust_score,
           public.report_weight(u.trust_score, r.created_at, r.distance_meters) AS weight
    FROM public.reports r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.restaurant_id = _restaurant_id
      AND r.created_at >= _window_start
  ), agg AS (
    SELECT reported_status, sum(weight) AS w FROM recent GROUP BY reported_status
  )
  SELECT
    (SELECT reported_status FROM agg WHERE w > 0 ORDER BY w DESC, reported_status LIMIT 1),
    COALESCE((SELECT max(w) FROM agg WHERE w > 0), 0),
    COALESCE((SELECT sum(w) FROM agg), 0),
    COALESCE((SELECT count(*) FROM recent WHERE weight > 0), 0),
    COALESCE((SELECT avg(GREATEST(LEAST(trust_score, 100), 0)) FROM recent WHERE weight > 0), 10),
    COALESCE((SELECT count(*) FROM recent WHERE created_at > now() - interval '60 minutes'), 0),
    (SELECT max(created_at) FROM recent WHERE weight > 0)
  INTO _best, _best_weight, _total_weight, _count, _avg_trust, _fresh, _last;

  IF _best IS NULL OR _count = 0 OR _total_weight <= 0 THEN
    INSERT INTO public.restaurant_status AS s (restaurant_id, status, confidence_score, report_count, last_updated)
    VALUES (_restaurant_id, 'unknown', 0, 0, NULL)
    ON CONFLICT (restaurant_id) DO UPDATE
      SET status = 'unknown', confidence_score = 0, report_count = 0, last_updated = NULL;
    RETURN;
  END IF;

  -- deterministic confidence: agreement 45% + volume 20% + trust 20% + recency 15%
  _agreement := _best_weight / _total_weight;                       -- 0..1
  _volume := LEAST(_count::numeric / 5, 1);                          -- saturates at 5 reports
  _trust_factor := LEAST(_avg_trust / 100, 1);
  _recency := CASE WHEN _fresh > 0 THEN 1 ELSE 0.5 END;

  _confidence := LEAST(99, GREATEST(5, round(
    100 * (0.45 * _agreement + 0.20 * _volume + 0.20 * _trust_factor + 0.15 * _recency)
  )::int));

  INSERT INTO public.restaurant_status AS s (restaurant_id, status, confidence_score, report_count, last_updated)
  VALUES (_restaurant_id, _best, _confidence, _count, _last)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET status = EXCLUDED.status,
        confidence_score = EXCLUDED.confidence_score,
        report_count = EXCLUDED.report_count,
        last_updated = EXCLUDED.last_updated;
END;
$$;

-- 4) Trust score maintenance ----------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_trust_score(_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rep public.reports;
  _status public.mookrob_status;
  _confidence integer := 0;
  _count integer := 0;
  _delta integer := 0;
  _burst integer := 0;
  _agrees boolean := false;
BEGIN
  SELECT * INTO _rep FROM public.reports WHERE id = _report_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT status, confidence_score, report_count
  INTO _status, _confidence, _count
  FROM public.restaurant_status WHERE restaurant_id = _rep.restaurant_id;

  -- only a reliable consensus may move trust; volume alone never rewards
  IF _status IS NOT NULL AND _status <> 'unknown' AND _confidence >= 60 AND _count >= 3 THEN
    _agrees := (_status = _rep.reported_status);
    _delta := CASE WHEN _agrees THEN 2 ELSE -2 END;
  END IF;

  -- GPS quality
  IF _rep.distance_meters IS NULL THEN
    _delta := _delta - 1;
  END IF;

  -- suspicious burst behaviour
  SELECT count(*) INTO _burst
  FROM public.reports
  WHERE user_id = _rep.user_id AND created_at > now() - interval '1 hour';
  IF _burst > 8 THEN
    _delta := _delta - 3;
  END IF;

  UPDATE public.users
  SET trust_score = GREATEST(0, LEAST(100, trust_score + _delta)),
      accurate_reports = accurate_reports + CASE WHEN _agrees THEN 1 ELSE 0 END
  WHERE id = _rep.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_report_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET total_reports = total_reports + 1 WHERE id = NEW.user_id;
  PERFORM public.recalc_restaurant_status(NEW.restaurant_id);
  PERFORM public.apply_trust_score(NEW.id);
  PERFORM public.recalc_restaurant_status(NEW.restaurant_id);
  RETURN NEW;
END;
$$;

-- 5) Daily reset / stale sweeper ------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_stale_restaurant_status()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n integer := 0;
BEGIN
  WITH stale AS (
    SELECT s.restaurant_id
    FROM public.restaurant_status s
    JOIN public.restaurants r ON r.id = s.restaurant_id
    WHERE s.status <> 'unknown'
      AND (s.last_updated IS NULL OR public.is_report_expired(s.last_updated, r.open_time))
  )
  UPDATE public.restaurant_status s
  SET status = 'unknown', confidence_score = 0, report_count = 0, last_updated = NULL
  WHERE s.restaurant_id IN (SELECT restaurant_id FROM stale);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- 6) Reads never surface stale status ------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_restaurants(
  _lat double precision,
  _lng double precision,
  _radius_meters integer DEFAULT 5000,
  _limit integer DEFAULT 60
)
RETURNS TABLE(id uuid, slug text, name text, area text, address text, latitude double precision, longitude double precision, open_time time without time zone, close_time time without time zone, hours_note text, price_min integer, price_max integer, rating numeric, image_url text, distance_meters double precision, status public.mookrob_status, confidence_score integer, report_count integer, last_updated timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    r.id, r.slug, r.name, r.area, r.address, r.latitude, r.longitude,
    r.open_time, r.close_time, r.hours_note, r.price_min, r.price_max, r.rating, r.image_url,
    extensions.st_distance(r.geog, extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography) AS distance_meters,
    CASE WHEN s.last_updated IS NULL OR public.is_report_expired(s.last_updated, r.open_time)
         THEN 'unknown'::public.mookrob_status ELSE COALESCE(s.status, 'unknown') END AS status,
    CASE WHEN s.last_updated IS NULL OR public.is_report_expired(s.last_updated, r.open_time)
         THEN 0 ELSE COALESCE(s.confidence_score, 0) END AS confidence_score,
    CASE WHEN s.last_updated IS NULL OR public.is_report_expired(s.last_updated, r.open_time)
         THEN 0 ELSE COALESCE(s.report_count, 0) END AS report_count,
    CASE WHEN s.last_updated IS NULL OR public.is_report_expired(s.last_updated, r.open_time)
         THEN NULL ELSE s.last_updated END AS last_updated
  FROM public.restaurants r
  LEFT JOIN public.restaurant_status s ON s.restaurant_id = r.id
  WHERE extensions.st_dwithin(
    r.geog,
    extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography,
    GREATEST(_radius_meters, 100)
  )
  ORDER BY distance_meters ASC
  LIMIT GREATEST(_limit, 1);
$$;

-- 7) Least privilege on engine internals
REVOKE ALL ON FUNCTION public.recalc_restaurant_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_trust_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_stale_restaurant_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.status_code(public.mookrob_status) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_report_expired(timestamptz, time) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_weight(integer, timestamptz, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_day_start(time) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_restaurant_status() TO service_role;

-- 8) Refresh all cached statuses under the new rules
DO $$
DECLARE _id uuid;
BEGIN
  FOR _id IN SELECT id FROM public.restaurants LOOP
    PERFORM public.recalc_restaurant_status(_id);
  END LOOP;
END $$;