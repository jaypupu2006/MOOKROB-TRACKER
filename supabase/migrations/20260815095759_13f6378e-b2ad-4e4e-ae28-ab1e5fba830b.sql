CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  from_status public.mookrob_status,
  to_status public.mookrob_status NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = public.current_profile_id());
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = public.current_profile_id());

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _title text;
  _body text;
BEGIN
  -- แจ้งเตือนเฉพาะเมื่อสถานะที่คำนวณได้เปลี่ยนจริง และสถานะใหม่มีข้อมูล
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'unknown' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _name FROM public.restaurants WHERE id = NEW.restaurant_id;

  IF NEW.status = 'available' THEN
    _title := 'ร้าน ' || _name || ' มีหมูกรอบแล้ว!';
    _body := 'มีผู้ใช้ยืนยันว่ามีหมูกรอบ ความมั่นใจ ' || NEW.confidence_score || '%';
  ELSIF NEW.status = 'low' THEN
    _title := 'หมูกรอบร้าน ' || _name || ' เหลือน้อยแล้ว';
    _body := 'ถ้าอยากกินวันนี้ ควรออกเดินทางเลย';
  ELSE
    _title := 'หมูกรอบร้าน ' || _name || ' หมดแล้ว';
    _body := 'ลองดูร้านอื่นใกล้คุณใน MooKrob Tracker';
  END IF;

  INSERT INTO public.notifications (user_id, restaurant_id, from_status, to_status, title, body)
  SELECT w.user_id, NEW.restaurant_id, OLD.status, NEW.status, _title, _body
  FROM public.watchlists w
  WHERE w.restaurant_id = NEW.restaurant_id
    AND w.notifications_enabled;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER restaurant_status_notify
AFTER UPDATE ON public.restaurant_status
FOR EACH ROW EXECUTE FUNCTION public.notify_status_change();