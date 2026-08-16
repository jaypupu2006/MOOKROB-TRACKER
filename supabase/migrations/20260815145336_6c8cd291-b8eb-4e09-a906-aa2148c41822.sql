ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'ร้านหมูกรอบ';

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_category_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_category_check
  CHECK (category IN ('ร้านหมูกรอบ', 'อาหารตามสั่ง', 'ก๋วยเตี๋ยว'));

UPDATE public.restaurants SET category = 'ก๋วยเตี๋ยว' WHERE name ILIKE '%ก๋วยเตี๋ยว%';

INSERT INTO public.restaurants
  (slug, name, area, address, latitude, longitude, open_time, close_time, hours_note, price_min, price_max, rating, category)
VALUES
  ('tamsang-ari', 'ครัวตามสั่งพี่อ้อ อารีย์', 'อารีย์', '12 ซอยอารีย์ 4 พหลโยธิน กรุงเทพฯ', 13.7799, 100.5443, '08:00', '20:00', 'ปิดวันอาทิตย์', 50, 90, 4.4, 'อาหารตามสั่ง'),
  ('tamsang-thonglor', 'ตามสั่งเจ๊แดง ทองหล่อ', 'ทองหล่อ', '45 ซอยทองหล่อ 13 กรุงเทพฯ', 13.7346, 100.5820, '09:00', '21:00', NULL, 60, 120, 4.6, 'อาหารตามสั่ง'),
  ('tamsang-ratchathewi', 'ข้าวราดแกงลุงหมี ราชเทวี', 'ราชเทวี', '88 ถนนเพชรบุรี ราชเทวี กรุงเทพฯ', 13.7519, 100.5330, '07:30', '17:00', NULL, 45, 80, 4.2, 'อาหารตามสั่ง'),
  ('tamsang-bangwa', 'ตามสั่งป้าเล็ก บางหว้า', 'บางหว้า', '9 ซอยเพชรเกษม 20 ภาษีเจริญ กรุงเทพฯ', 13.7205, 100.4570, '08:00', '19:00', NULL, 45, 85, 4.3, 'อาหารตามสั่ง'),
  ('tamsang-ladprao', 'ครัวคุณต้อย ลาดพร้าว', 'ลาดพร้าว', '210 ซอยลาดพร้าว 71 กรุงเทพฯ', 13.7930, 100.6060, '09:00', '20:30', NULL, 50, 100, 4.1, 'อาหารตามสั่ง'),
  ('tamsang-rama3', 'ตามสั่งเฮียชัย พระราม 3', 'พระราม 3', '77 ถนนพระราม 3 ยานนาวา กรุงเทพฯ', 13.6890, 100.5430, '10:00', '22:00', 'ปิดวันจันทร์', 55, 110, 4.5, 'อาหารตามสั่ง'),
  ('tamsang-bangna', 'ครัวบ้านนา บางนา', 'บางนา', '303 ถนนสุขุมวิท บางนา กรุงเทพฯ', 13.6700, 100.6040, '08:30', '19:30', NULL, 45, 95, 4.0, 'อาหารตามสั่ง')
ON CONFLICT (slug) DO NOTHING;

DROP FUNCTION IF EXISTS public.nearby_restaurants(double precision, double precision, integer, integer);

CREATE FUNCTION public.nearby_restaurants(_lat double precision, _lng double precision, _radius_meters integer DEFAULT 5000, _limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, slug text, name text, area text, address text, latitude double precision, longitude double precision, open_time time without time zone, close_time time without time zone, hours_note text, price_min integer, price_max integer, rating numeric, image_url text, category text, distance_meters double precision, status mookrob_status, confidence_score integer, report_count integer, last_updated timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    r.id, r.slug, r.name, r.area, r.address, r.latitude, r.longitude,
    r.open_time, r.close_time, r.hours_note, r.price_min, r.price_max, r.rating, r.image_url, r.category,
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
$function$;

GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, integer, integer) TO anon, authenticated, service_role;