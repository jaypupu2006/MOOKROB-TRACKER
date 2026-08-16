import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { NearbyRow, Report, StatusKey } from "./mookrob";
import { timeAgoThai } from "./mookrob";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function getPublicRestaurants(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}): Promise<NearbyRow[]> {
  const supabase = publicClient();
  const { data, error } = await supabase.rpc("nearby_restaurants", {
    _lat: input.lat,
    _lng: input.lng,
    _radius_meters: input.radiusMeters,
    _limit: input.limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NearbyRow[];
}

export async function getPublicRestaurant(input: { slug: string; lat: number; lng: number }) {
  const supabase = publicClient();

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, area, address, latitude, longitude, open_time, close_time, hours_note, price_min, price_max, rating, image_url",
    )
    .eq("slug", input.slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!restaurant) return null;

  const [{ data: status }, { data: reportRows }] = await Promise.all([
    supabase
      .from("restaurant_status")
      .select("status, confidence_score, report_count, last_updated")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id, reported_status, note, created_at, users(username)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const distanceMeters = haversine(
    input.lat,
    input.lng,
    Number(restaurant.latitude),
    Number(restaurant.longitude),
  );

  const row: NearbyRow = {
    ...restaurant,
    latitude: Number(restaurant.latitude),
    longitude: Number(restaurant.longitude),
    distance_meters: distanceMeters,
    status: (status?.status ?? "unknown") as StatusKey,
    confidence_score: status?.confidence_score ?? 0,
    report_count: status?.report_count ?? 0,
    last_updated: status?.last_updated ?? null,
  };

  const reports: Report[] = (reportRows ?? []).map((r) => ({
    id: r.id,
    user: (r.users as { username: string } | null)?.username ?? "ผู้ใช้ MooKrob",
    status: r.reported_status as StatusKey,
    timeAgo: timeAgoThai(r.created_at),
    ...(r.note ? { note: r.note } : {}),
  }));

  return { row, reports };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
