-- PostGIS support for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TYPE public.mookrob_status AS ENUM ('available', 'low', 'out', 'unknown');

-- ========== users (app profiles) ==========
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  username text NOT NULL CHECK (char_length(btrim(username)) BETWEEN 2 AND 40),
  avatar_url text,
  trust_score integer NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  total_reports integer NOT NULL DEFAULT 0 CHECK (total_reports >= 0),
  accurate_reports integer NOT NULL DEFAULT 0 CHECK (accurate_reports >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_accurate_lte_total CHECK (accurate_reports <= total_reports)
);
CREATE INDEX users_auth_user_id_idx ON public.users (auth_user_id);

GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_public_read" ON public.users FOR SELECT TO anon, authenticated USING (true);

-- ========== restaurants ==========
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name text NOT NULL,
  area text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geog extensions.geography(Point, 4326) GENERATED ALWAYS AS (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) STORED,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  hours_note text,
  price_min integer NOT NULL DEFAULT 50 CHECK (price_min >= 0),
  price_max integer NOT NULL DEFAULT 100 CHECK (price_max >= 0),
  rating numeric(2, 1) NOT NULL DEFAULT 4.0 CHECK (rating BETWEEN 0 AND 5),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurants_price_range CHECK (price_max >= price_min)
);
CREATE INDEX restaurants_geog_idx ON public.restaurants USING gist (geog);
CREATE INDEX restaurants_area_idx ON public.restaurants (area);

GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurants_public_read" ON public.restaurants FOR SELECT TO anon, authenticated USING (true);

-- ========== restaurant_status (system-calculated) ==========
CREATE TABLE public.restaurant_status (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants (id) ON DELETE CASCADE,
  status public.mookrob_status NOT NULL DEFAULT 'unknown',
  confidence_score integer NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  last_updated timestamptz
);
CREATE INDEX restaurant_status_status_idx ON public.restaurant_status (status);

GRANT SELECT ON public.restaurant_status TO anon;
GRANT SELECT ON public.restaurant_status TO authenticated;
GRANT ALL ON public.restaurant_status TO service_role;
ALTER TABLE public.restaurant_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_status_public_read" ON public.restaurant_status FOR SELECT TO anon, authenticated USING (true);

-- ========== reports ==========
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reported_status public.mookrob_status NOT NULL CHECK (reported_status <> 'unknown'),
  note text CHECK (note IS NULL OR char_length(note) <= 280),
  user_lat double precision CHECK (user_lat IS NULL OR user_lat BETWEEN -90 AND 90),
  user_lng double precision CHECK (user_lng IS NULL OR user_lng BETWEEN -180 AND 180),
  distance_meters integer CHECK (distance_meters IS NULL OR distance_meters >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_restaurant_created_idx ON public.reports (restaurant_id, created_at DESC);
CREATE INDEX reports_user_created_idx ON public.reports (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ========== watchlists ==========
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlists_unique_pair UNIQUE (user_id, restaurant_id)
);
CREATE INDEX watchlists_user_idx ON public.watchlists (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- ========== helper: current profile id ==========
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;

CREATE POLICY "reports_public_read" ON public.reports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());

CREATE POLICY "watchlists_select_own" ON public.watchlists FOR SELECT TO authenticated
  USING (user_id = public.current_profile_id());
CREATE POLICY "watchlists_insert_own" ON public.watchlists FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "watchlists_update_own" ON public.watchlists FOR UPDATE TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY "watchlists_delete_own" ON public.watchlists FOR DELETE TO authenticated
  USING (user_id = public.current_profile_id());

-- ========== profile bootstrap ==========
CREATE OR REPLACE FUNCTION public.ensure_profile(_username text DEFAULT NULL)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.users;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _row FROM public.users WHERE auth_user_id = _uid;
  IF FOUND THEN
    RETURN _row;
  END IF;

  INSERT INTO public.users (auth_user_id, username)
  VALUES (
    _uid,
    COALESCE(
      NULLIF(btrim(_username), ''),
      NULLIF(split_part((SELECT email FROM auth.users WHERE id = _uid), '@', 1), ''),
      'ผู้ใช้ใหม่'
    )
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile(text) TO authenticated;

-- ========== system status calculation ==========
CREATE OR REPLACE FUNCTION public.recalc_restaurant_status(_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window interval := interval '6 hours';
  _total numeric := 0;
  _best public.mookrob_status := 'unknown';
  _best_weight numeric := 0;
  _count integer := 0;
  _last timestamptz;
  _confidence integer := 0;
BEGIN
  WITH recent AS (
    SELECT
      r.reported_status,
      (
        (0.4 + 0.6 * (COALESCE(u.trust_score, 50)::numeric / 100))
        * exp(-EXTRACT(EPOCH FROM (now() - r.created_at)) / 7200.0)
        * CASE
            WHEN r.distance_meters IS NULL THEN 0.8
            WHEN r.distance_meters <= 150 THEN 1.0
            WHEN r.distance_meters <= 1000 THEN 0.75
            ELSE 0.4
          END
      ) AS weight
    FROM public.reports r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.restaurant_id = _restaurant_id
      AND r.created_at > now() - _window
  ), agg AS (
    SELECT reported_status, sum(weight) AS w FROM recent GROUP BY reported_status
  )
  SELECT
    (SELECT reported_status FROM agg ORDER BY w DESC LIMIT 1),
    COALESCE((SELECT max(w) FROM agg), 0),
    COALESCE((SELECT sum(w) FROM agg), 0)
  INTO _best, _best_weight, _total;

  SELECT count(*), max(created_at) INTO _count, _last
  FROM public.reports
  WHERE restaurant_id = _restaurant_id AND created_at > now() - _window;

  IF _best IS NULL OR _count = 0 THEN
    _best := 'unknown';
    _confidence := 0;
  ELSE
    _confidence := LEAST(
      99,
      GREATEST(
        10,
        round((_best_weight / GREATEST(_total, 0.0001)) * 100 * (1 - exp(-_total * 1.2)))::int
      )
    );
  END IF;

  INSERT INTO public.restaurant_status AS s (restaurant_id, status, confidence_score, report_count, last_updated)
  VALUES (_restaurant_id, _best, _confidence, _count, _last)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET status = EXCLUDED.status,
        confidence_score = EXCLUDED.confidence_score,
        report_count = EXCLUDED.report_count,
        last_updated = EXCLUDED.last_updated;
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER reports_after_insert
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.on_report_inserted();

CREATE OR REPLACE FUNCTION public.on_restaurant_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.restaurant_status (restaurant_id) VALUES (NEW.id)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_after_insert
AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.on_restaurant_inserted();

-- ========== geographic query ==========
CREATE OR REPLACE FUNCTION public.nearby_restaurants(
  _lat double precision,
  _lng double precision,
  _radius_meters integer DEFAULT 5000,
  _limit integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  area text,
  address text,
  latitude double precision,
  longitude double precision,
  open_time time,
  close_time time,
  hours_note text,
  price_min integer,
  price_max integer,
  rating numeric,
  image_url text,
  distance_meters double precision,
  status public.mookrob_status,
  confidence_score integer,
  report_count integer,
  last_updated timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    r.id, r.slug, r.name, r.area, r.address, r.latitude, r.longitude,
    r.open_time, r.close_time, r.hours_note, r.price_min, r.price_max, r.rating, r.image_url,
    extensions.st_distance(r.geog, extensions.st_setsrid(extensions.st_makepoint(_lng, _lat), 4326)::extensions.geography) AS distance_meters,
    COALESCE(s.status, 'unknown') AS status,
    COALESCE(s.confidence_score, 0) AS confidence_score,
    COALESCE(s.report_count, 0) AS report_count,
    s.last_updated
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

GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, integer, integer) TO anon, authenticated;