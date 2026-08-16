CREATE OR REPLACE FUNCTION public.validate_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _r public.restaurants;
  _dist double precision;
  _last timestamptz;
  _recent integer;
BEGIN
  IF NEW.user_lat IS NULL OR NEW.user_lng IS NULL THEN
    RAISE EXCEPTION 'MOOKROB_NO_LOCATION';
  END IF;
  IF NEW.user_lat < -90 OR NEW.user_lat > 90 OR NEW.user_lng < -180 OR NEW.user_lng > 180 THEN
    RAISE EXCEPTION 'MOOKROB_INVALID_LOCATION';
  END IF;

  SELECT * INTO _r FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MOOKROB_RESTAURANT_NOT_FOUND';
  END IF;

  _dist := extensions.st_distance(
    extensions.st_setsrid(extensions.st_makepoint(NEW.user_lng, NEW.user_lat), 4326)::extensions.geography,
    extensions.st_setsrid(extensions.st_makepoint(_r.longitude, _r.latitude), 4326)::extensions.geography
  );
  NEW.distance_meters := round(_dist)::int;

  IF _dist > 100 THEN
    RAISE EXCEPTION 'MOOKROB_TOO_FAR:%', round(_dist)::int;
  END IF;

  SELECT max(created_at) INTO _last
  FROM public.reports
  WHERE user_id = NEW.user_id AND restaurant_id = NEW.restaurant_id;

  IF _last IS NOT NULL AND _last > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'MOOKROB_COOLDOWN:%', GREATEST(1, ceil(EXTRACT(EPOCH FROM (_last + interval '10 minutes' - now())) / 60))::int;
  END IF;

  SELECT count(*) INTO _recent
  FROM public.reports
  WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour';

  IF _recent >= 12 THEN
    RAISE EXCEPTION 'MOOKROB_RATE_LIMIT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_before_insert ON public.reports;
CREATE TRIGGER reports_before_insert
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.validate_report();

CREATE INDEX IF NOT EXISTS reports_user_created_idx ON public.reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_restaurant_created_idx ON public.reports (user_id, restaurant_id, created_at DESC);

REVOKE ALL ON FUNCTION public.validate_report() FROM PUBLIC, anon, authenticated;