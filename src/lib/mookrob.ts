/**
 * โมเดลข้อมูลฝั่งหน้าเว็บของ MooKrob Tracker
 * แปลงข้อมูลจากฐานข้อมูล (Lovable Cloud) ให้เป็นรูปแบบที่คอมโพเนนต์ UI ใช้อยู่เดิม
 */

import {
  isOpenNow,
  isReportExpired,
  STATUS_CODE,
  statusHint,
} from "./mookrob-status";

export type StatusKey = "available" | "low" | "out" | "unknown";

/** ประเภทร้าน ใช้ทำ tag filter ในหน้าแผนที่ */
export type CategoryKey = "ร้านหมูกรอบ" | "อาหารตามสั่ง" | "ก๋วยเตี๋ยว";

export const CATEGORIES: CategoryKey[] = ["ร้านหมูกรอบ", "อาหารตามสั่ง", "ก๋วยเตี๋ยว"];

export const STATUS_LABEL: Record<StatusKey, string> = {
  available: "มีหมูกรอบ",
  low: "เหลือน้อย",
  out: "หมดแล้ว",
  unknown: "ยังไม่มีข้อมูล",
};

export const STATUS_EMOJI: Record<StatusKey, string> = {
  available: "🟢",
  low: "🟡",
  out: "🔴",
  unknown: "⚪",
};

export type Report = {
  id: string;
  user: string;
  status: StatusKey;
  timeAgo: string;
  note?: string;
};

export type Restaurant = {
  /** slug ที่ใช้ใน URL */
  id: string;
  /** primary key ในฐานข้อมูล */
  dbId: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  openTime: string;
  closeTime: string;
  distanceKm: number;
  status: StatusKey;
  /** 2 = มีหมูกรอบ, 1 = เหลือน้อย, 0 = หมดแล้ว, null = ยังไม่มีข้อมูล */
  statusCode: number | null;
  updatedAgo: string;
  confidence: number;
  reportCount: number;
  /** ข้อความเตือนข้อมูลเก่า / ร้านปิด / รอข้อมูล */
  statusHint: string | null;
  isOpen: boolean;
  favorite: boolean;
  priceRange: string;
  rating: number;
  category: CategoryKey;
  latitude: number;
  longitude: number;
  /** ตำแหน่งบนแผนที่จำลอง (เปอร์เซ็นต์) */
  x: number;
  y: number;
  reports: Report[];
};


/** ตำแหน่งตั้งต้น (สยาม กรุงเทพฯ) ใช้เมื่อผู้ใช้ยังไม่ให้สิทธิ์ตำแหน่ง */
export const DEFAULT_LOCATION = { lat: 13.7465, lng: 100.535 };
export const DEFAULT_RADIUS_METERS = 15000;

export function timeAgoThai(value: string | null | undefined, fallback = "ยังไม่มีรายงานวันนี้") {
  if (!value) return fallback;
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.round(hours / 24);
  if (days === 1) return "เมื่อวาน";
  return `${days} วันที่แล้ว`;
}

/** แสดงระยะทางให้อ่านง่าย: ต่ำกว่า 1 กม. เป็นเมตร */
/** ระยะทางระหว่างสองพิกัด (เมตร) ด้วยสูตร Haversine */
export function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** ระยะทางเป็นกิโลเมตร */
export function distanceKmBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  return distanceMeters(from, to) / 1000;
}

export function formatDistance(distanceKm: number) {
  if (!Number.isFinite(distanceKm)) return "—";
  const meters = distanceKm * 1000;
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} ม.`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} กม.`;
  return `${Math.round(distanceKm)} กม.`;
}


function hhmm(time: string) {
  return time.slice(0, 5);
}

export function formatHours(open: string, close: string, note: string | null) {
  return `${hhmm(open)} – ${hhmm(close)}${note ? ` (${note})` : " ทุกวัน"}`;
}

export type NearbyRow = {
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
  rating: number | string;
  image_url: string | null;
  category?: string | null;
  distance_meters: number;
  status: StatusKey;
  confidence_score: number;
  report_count: number;
  last_updated: string | null;
};

export function toRestaurant(
  row: NearbyRow,
  options: { favorite?: boolean; reports?: Report[] } = {},
): Restaurant {
  // ตัดข้อมูลที่หมดอายุ (เก่ากว่า 3 ชม. หรือคนละวันทำการ) ออกก่อนแสดงผล
  const expired = isReportExpired(row.last_updated, row.open_time);
  const status: StatusKey = expired ? "unknown" : row.status;
  const lastUpdated = expired ? null : row.last_updated;

  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    hours: formatHours(row.open_time, row.close_time, row.hours_note),
    openTime: row.open_time,
    closeTime: row.close_time,
    distanceKm: row.distance_meters / 1000,
    status,
    statusCode: STATUS_CODE[status],
    updatedAgo: timeAgoThai(lastUpdated),
    confidence: expired ? 0 : row.confidence_score,
    reportCount: expired ? 0 : row.report_count,
    statusHint: statusHint({
      lastUpdated,
      openTime: row.open_time,
      closeTime: row.close_time,
    }),
    isOpen: isOpenNow(row.open_time, row.close_time),
    favorite: options.favorite ?? false,
    priceRange: `${row.price_min} – ${row.price_max} ฿`,
    category: (CATEGORIES as string[]).includes(row.category ?? "")
      ? (row.category as CategoryKey)
      : "ร้านหมูกรอบ",
    rating: Number(row.rating),
    latitude: row.latitude,
    longitude: row.longitude,
    x: 50,
    y: 50,
    reports: options.reports ?? [],
  };
}


