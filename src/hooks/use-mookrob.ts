import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  getUserLocationServerSnapshot,
  getUserLocationSnapshot,
  requestUserLocation,
  subscribeUserLocation,
} from "@/lib/user-location";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { listNearbyRestaurants } from "@/lib/mookrob.functions";
import {
  
  DEFAULT_RADIUS_METERS,
  timeAgoThai,
  toRestaurant,
  type NearbyRow,
  type Report,
  type Restaurant,
  type StatusKey,
} from "@/lib/mookrob";

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  trust_score: number;
  total_reports: number;
  accurate_reports: number;
  created_at: string;
};

/** เซสชันผู้ใช้ปัจจุบัน */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/** โปรไฟล์ในตาราง users (สร้างอัตโนมัติเมื่อเข้าสู่ระบบครั้งแรก) */
export function useProfile() {
  const { session, loading } = useSession();
  const query = useQuery({
    queryKey: ["profile", session?.user.id ?? null],
    enabled: !loading && !!session,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.rpc("ensure_profile", {});
      if (error) throw new Error(error.message);
      return (data as unknown as Profile) ?? null;
    },
  });
  return { session, sessionLoading: loading, profile: query.data ?? null, ...query };
}

/** ตำแหน่งผู้ใช้แบบใช้ร่วมกันทั้งแอป (ขอ GPS อัตโนมัติ + จำค่าล่าสุด) */
export function useMyLocation() {
  const state = useSyncExternalStore(
    subscribeUserLocation,
    getUserLocationSnapshot,
    getUserLocationServerSnapshot,
  );

  useEffect(() => {
    requestUserLocation();
  }, []);

  const request = useCallback(() => requestUserLocation({ force: true }), []);

  return {
    location: state.location,
    precise: state.precise,
    status: state.status,
    checking: state.status === "checking",
    request,
  };
}


/** รายชื่อร้านใกล้ตัวจากฐานข้อมูล */
export function useNearbyRestaurants(location: { lat: number; lng: number }) {
  const fetchNearby = useServerFn(listNearbyRestaurants);
  const watchlist = useWatchlistIds();

  const query = useQuery({
    queryKey: ["nearby", location.lat.toFixed(3), location.lng.toFixed(3)],
    queryFn: () =>
      fetchNearby({
        data: {
          lat: location.lat,
          lng: location.lng,
          radiusMeters: DEFAULT_RADIUS_METERS,
          limit: 60,
        },
      }),
  });

  const restaurants: Restaurant[] = (query.data ?? []).map((row) =>
    toRestaurant(row as NearbyRow, { favorite: watchlist.has(row.id) }),
  );

  return { ...query, restaurants };
}

/** รหัสร้านที่อยู่ในรายการติดตามของฉัน */
export function useWatchlistIds() {
  const { data } = useWatchlist();
  return new Set((data ?? []).map((item) => item.restaurant_id));
}

type WatchlistRow = {
  id: string;
  restaurant_id: string;
  notifications_enabled: boolean;
  restaurants: {
    id: string;
    slug: string;
    name: string;
    area: string;
    address: string;
    latitude: number;
    longitude: number;
    open_time: string;
    close_time: string;
    hours_note: string | null;
    price_min: number;
    price_max: number;
    rating: number;
    image_url: string | null;
    restaurant_status: {
      status: StatusKey;
      confidence_score: number;
      report_count: number;
      last_updated: string | null;
    } | null;
  } | null;
};

/** รายการร้านโปรดของฉัน */
export function useWatchlist() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["watchlist", session?.user.id ?? null],
    enabled: !!session,
    queryFn: async (): Promise<WatchlistRow[]> => {
      const { data, error } = await supabase
        .from("watchlists")
        .select(
          "id, restaurant_id, notifications_enabled, restaurants(id, slug, name, area, address, latitude, longitude, open_time, close_time, hours_note, price_min, price_max, rating, image_url, restaurant_status(status, confidence_score, report_count, last_updated))",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as WatchlistRow[];
    },
  });
}

export function watchlistToRestaurants(
  rows: WatchlistRow[],
  origin: { lat: number; lng: number },
): Restaurant[] {
  return rows
    .filter((row): row is WatchlistRow & { restaurants: NonNullable<WatchlistRow["restaurants"]> } =>
      Boolean(row.restaurants),
    )
    .map((row) => {
      const r = row.restaurants;
      const status = r.restaurant_status;
      return toRestaurant(
        {
          ...r,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          distance_meters: haversine(origin.lat, origin.lng, Number(r.latitude), Number(r.longitude)),
          status: status?.status ?? "unknown",
          confidence_score: status?.confidence_score ?? 0,
          report_count: status?.report_count ?? 0,
          last_updated: status?.last_updated ?? null,
        },
        { favorite: true },
      );
    });
}

/** เพิ่ม/นำร้านออกจากรายการติดตาม */
export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ restaurantId, add }: { restaurantId: string; add: boolean }) => {
      const { data: profile, error: profileError } = await supabase.rpc("ensure_profile", {});
      if (profileError) throw new Error(profileError.message);
      const profileId = (profile as unknown as Profile).id;

      if (add) {
        const { error } = await supabase
          .from("watchlists")
          .insert({ restaurant_id: restaurantId, user_id: profileId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("watchlists")
          .delete()
          .eq("restaurant_id", restaurantId)
          .eq("user_id", profileId);
        if (error) throw new Error(error.message);
      }
      return add;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

/** เปิด/ปิดการแจ้งเตือนของร้านที่ติดตาม */
export function useToggleWatchlistNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("watchlists")
        .update({ notifications_enabled: enabled })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return enabled;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

export type MookrobNotification = {
  id: string;
  title: string;
  body: string | null;
  to_status: StatusKey;
  from_status: StatusKey | null;
  read_at: string | null;
  created_at: string;
  timeAgo: string;
  restaurantSlug: string | null;
};

/** การแจ้งเตือนของฉัน (สร้างเฉพาะเมื่อสถานะร้านที่ติดตามเปลี่ยนจริง) */
export function useNotifications() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["notifications", session?.user.id ?? null],
    enabled: !!session,
    refetchInterval: 60000,
    queryFn: async (): Promise<MookrobNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, to_status, from_status, read_at, created_at, restaurants(slug)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        to_status: row.to_status as StatusKey,
        from_status: (row.from_status as StatusKey | null) ?? null,
        read_at: row.read_at,
        created_at: row.created_at,
        timeAgo: timeAgoThai(row.created_at, "เมื่อสักครู่"),
        restaurantSlug: (row.restaurants as { slug: string } | null)?.slug ?? null,
      }));
    },
  });
}

/** ทำเครื่องหมายว่าอ่านการแจ้งเตือนทั้งหมดแล้ว */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export const REPORT_RADIUS_METERS = 100;


/** ขอพิกัด GPS ปัจจุบันแบบแม่นยำ (คืน Promise) */
export function getPrecisePosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        ) {
          reject(new Error("พิกัดที่ได้ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"));
          return;
        }
        resolve({ lat, lng });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("คุณปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์"));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("ตรวจสอบตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง"));
        } else {
          reject(new Error("ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาลองใหม่อีกครั้ง"));
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

/** แปลงข้อผิดพลาดจากฐานข้อมูลให้เป็นข้อความไทย */
export function reportErrorMessage(message: string): string {
  if (message.includes("MOOKROB_TOO_FAR")) {
    const meters = message.split("MOOKROB_TOO_FAR:")[1]?.match(/\d+/)?.[0];
    return meters
      ? `คุณอยู่ห่างจากร้าน ${meters} เมตร (เกิน ${REPORT_RADIUS_METERS} เมตร)`
      : `คุณอยู่ห่างจากร้านเกิน ${REPORT_RADIUS_METERS} เมตร`;
  }
  if (message.includes("MOOKROB_COOLDOWN")) {
    const minutes = message.split("MOOKROB_COOLDOWN:")[1]?.match(/\d+/)?.[0];
    return minutes
      ? `คุณเพิ่งรายงานร้านนี้ไป กรุณารออีก ${minutes} นาที`
      : "คุณเพิ่งรายงานร้านนี้ไป กรุณารอสักครู่";
  }
  if (message.includes("MOOKROB_RATE_LIMIT"))
    return "คุณรายงานถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  if (message.includes("MOOKROB_RESTAURANT_NOT_FOUND")) return "ไม่พบร้านนี้ในระบบ";
  if (message.includes("MOOKROB_INVALID_LOCATION") || message.includes("MOOKROB_NO_LOCATION"))
    return "พิกัดตำแหน่งไม่ถูกต้อง กรุณาเปิด GPS แล้วลองใหม่";
  if (message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network"))
    return "เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  return "ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง";
}

/** ส่งรายงานสถานะหมูกรอบ (ตรวจระยะทางและกันสแปมที่ฝั่งฐานข้อมูล) */
export function useSubmitReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      restaurantId: string;
      status: StatusKey;
      userLat: number;
      userLng: number;
      restaurantLat: number;
      restaurantLng: number;
      note?: string;
    }) => {
      const { data: profile, error: profileError } = await supabase.rpc("ensure_profile", {});
      if (profileError) throw new Error(profileError.message);
      const profileId = (profile as unknown as Profile).id;

      const { error } = await supabase.from("reports").insert({
        restaurant_id: input.restaurantId,
        user_id: profileId,
        reported_status: input.status,
        ...(input.note ? { note: input.note } : {}),
        user_lat: input.userLat,
        user_lng: input.userLng,
        distance_meters: haversine(
          input.userLat,
          input.userLng,
          input.restaurantLat,
          input.restaurantLng,
        ),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      void queryClient.invalidateQueries({ queryKey: ["nearby"] });
      void queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}


/** รายงานล่าสุดของฉัน */
export function useMyReports() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["my-reports", session?.user.id ?? null],
    enabled: !!session,
    queryFn: async (): Promise<Report[]> => {
      const { data: profile, error: profileError } = await supabase.rpc("ensure_profile", {});
      if (profileError) throw new Error(profileError.message);
      const profileId = (profile as unknown as Profile).id;

      const { data, error } = await supabase
        .from("reports")
        .select("id, reported_status, note, created_at, restaurants(name)")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const restaurant = row.restaurants as { name: string } | null;
        return {
          id: row.id,
          user: restaurant?.name ?? "ร้านหมูกรอบ",
          status: row.reported_status as StatusKey,
          timeAgo: timeAgoThai(row.created_at),
          ...(row.note ? { note: row.note } : {}),
        };
      });
    },
  });
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
