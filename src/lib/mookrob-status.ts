/**
 * เครื่องคำนวณสถานะหมูกรอบ (ฝั่งอ่าน/แสดงผล)
 * ตรรกะเดียวกับฟังก์ชันในฐานข้อมูล (recalc_restaurant_status / report_weight / is_report_expired)
 * ฐานข้อมูลเป็นแหล่งความจริงเสมอ — โมดูลนี้ใช้เพื่อคำนวณซ้ำและตัดข้อมูลเก่าออกก่อนแสดงผล
 */

import type { StatusKey } from "./mookrob";

/** รหัสสถานะ: 2 = มีหมูกรอบ, 1 = เหลือน้อย, 0 = หมดแล้ว, null = ยังไม่มีข้อมูล */
export const STATUS_CODE: Record<StatusKey, number | null> = {
  available: 2,
  low: 1,
  out: 0,
  unknown: null,
};

export function statusFromCode(code: number | null | undefined): StatusKey {
  if (code === 2) return "available";
  if (code === 1) return "low";
  if (code === 0) return "out";
  return "unknown";
}

export const FRESH_WINDOW_MINUTES = 60;
export const EXPIRY_WINDOW_MINUTES = 180;

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function minutesOfDayFromTime(time: string) {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** เวลาเปิดร้านของ "วันทำการปัจจุบัน" (เขตเวลาไทย) */
export function businessDayStart(openTime: string, now = new Date()): Date {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const dayStartUtcMs =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BANGKOK_OFFSET_MS;
  let start = dayStartUtcMs + minutesOfDayFromTime(openTime) * 60_000;
  if (now.getTime() < start) start -= 24 * 60 * 60 * 1000;
  return new Date(start);
}

/** รายงานหมดอายุเมื่อเก่ากว่า 3 ชั่วโมง หรืออยู่ก่อนเวลาเปิดของวันทำการปัจจุบัน */
export function isReportExpired(
  createdAt: string | Date | null | undefined,
  openTime: string,
  now = new Date(),
): boolean {
  if (!createdAt) return true;
  const at = new Date(createdAt).getTime();
  if (!Number.isFinite(at)) return true;
  const cutoff = Math.max(
    now.getTime() - EXPIRY_WINDOW_MINUTES * 60_000,
    businessDayStart(openTime, now).getTime(),
  );
  return at < cutoff;
}

export type WeightInput = {
  trustScore: number | null | undefined;
  createdAt: string | Date;
  distanceMeters: number | null | undefined;
};

/** น้ำหนักของรายงานหนึ่งชิ้น = คะแนนความน่าเชื่อถือ × ความสดของข้อมูล × คุณภาพ GPS */
export function calculateReportWeight(input: WeightInput, now = new Date()): number {
  const trust = Math.min(Math.max(input.trustScore ?? 10, 0), 100);
  const ageMinutes = (now.getTime() - new Date(input.createdAt).getTime()) / 60_000;

  const recency =
    ageMinutes <= FRESH_WINDOW_MINUTES ? 1 : ageMinutes <= EXPIRY_WINDOW_MINUTES ? 0.5 : 0;

  const distance = input.distanceMeters;
  const gps =
    distance == null ? 0.5 : distance <= 100 ? 1 : distance <= 300 ? 0.6 : 0.3;

  return Number((trust * recency * gps).toFixed(4));
}

export type EngineReport = {
  status: StatusKey;
  createdAt: string | Date;
  trustScore: number | null | undefined;
  distanceMeters: number | null | undefined;
};

export type StatusResult = {
  status: StatusKey;
  statusCode: number | null;
  confidence: number;
  reportCount: number;
  lastUpdated: string | null;
};

export type ConfidenceInput = {
  agreement: number;
  reportCount: number;
  averageTrust: number;
  hasFreshReport: boolean;
};

/**
 * คะแนนความมั่นใจ (0–99%) แบบอธิบายได้:
 * ความสอดคล้อง 45% + จำนวนรายงาน 20% + ความน่าเชื่อถือผู้รายงาน 20% + ความสดของข้อมูล 15%
 */
export function calculateConfidenceScore(input: ConfidenceInput): number {
  if (input.reportCount <= 0) return 0;
  const agreement = Math.min(Math.max(input.agreement, 0), 1);
  const volume = Math.min(input.reportCount / 5, 1);
  const trust = Math.min(Math.max(input.averageTrust, 0), 100) / 100;
  const recency = input.hasFreshReport ? 1 : 0.5;
  const score = Math.round(
    100 * (0.45 * agreement + 0.2 * volume + 0.2 * trust + 0.15 * recency),
  );
  return Math.min(99, Math.max(5, score));
}

/** ฉันทามติแบบถ่วงน้ำหนัก — ไม่ใช้การนับโหวตธรรมดา */
export function calculateRestaurantStatus(
  reports: EngineReport[],
  openTime: string,
  now = new Date(),
): StatusResult {
  const empty: StatusResult = {
    status: "unknown",
    statusCode: null,
    confidence: 0,
    reportCount: 0,
    lastUpdated: null,
  };

  const usable = reports
    .filter((r) => !isReportExpired(r.createdAt, openTime, now))
    .map((r) => ({ ...r, weight: calculateReportWeight(r, now) }))
    .filter((r) => r.weight > 0);

  if (usable.length === 0) return empty;

  const weights = new Map<StatusKey, number>();
  for (const r of usable) weights.set(r.status, (weights.get(r.status) ?? 0) + r.weight);

  const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
  const [best] = [...weights.entries()].sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  );
  if (!best || total <= 0) return empty;

  const [status, bestWeight] = best;
  const averageTrust =
    usable.reduce((sum, r) => sum + Math.min(Math.max(r.trustScore ?? 10, 0), 100), 0) /
    usable.length;
  const hasFreshReport = usable.some(
    (r) =>
      (now.getTime() - new Date(r.createdAt).getTime()) / 60_000 <= FRESH_WINDOW_MINUTES,
  );
  const lastUpdated = usable
    .map((r) => new Date(r.createdAt).toISOString())
    .sort()
    .at(-1)!;

  return {
    status,
    statusCode: STATUS_CODE[status],
    confidence: calculateConfidenceScore({
      agreement: bestWeight / total,
      reportCount: usable.length,
      averageTrust,
      hasFreshReport,
    }),
    reportCount: usable.length,
    lastUpdated,
  };
}

export type TrustInput = {
  currentScore: number;
  agreesWithConsensus: boolean;
  consensusReliable: boolean;
  hasValidGps: boolean;
  reportsInLastHour: number;
};

/**
 * คะแนนความน่าเชื่อถือ 0–100 (ผู้ใช้ใหม่เริ่มที่ 10)
 * ขยับเฉพาะเมื่อเทียบกับฉันทามติที่เชื่อถือได้ — การรายงานถี่ ๆ ไม่ทำให้คะแนนเพิ่ม
 */
export const NEW_USER_TRUST_SCORE = 10;

export function calculateTrustScore(input: TrustInput): number {
  let delta = 0;
  if (input.consensusReliable) delta += input.agreesWithConsensus ? 2 : -2;
  if (!input.hasValidGps) delta -= 1;
  if (input.reportsInLastHour > 8) delta -= 3;
  return Math.min(100, Math.max(0, input.currentScore + delta));
}

export type Freshness = {
  tier: "fresh" | "aging" | "expired";
  /** ข้อความเตือนใต้สถานะ (ถ้ามี) */
  warning: string | null;
};

/** ระดับความสดของข้อมูลสถานะสำหรับแสดงผล */
export function statusFreshness(
  lastUpdated: string | null | undefined,
  openTime: string,
  now = new Date(),
): Freshness {
  if (!lastUpdated || isReportExpired(lastUpdated, openTime, now)) {
    return { tier: "expired", warning: "⚪ ยังไม่มีข้อมูลล่าสุด" };
  }
  const ageMinutes = (now.getTime() - new Date(lastUpdated).getTime()) / 60_000;
  if (ageMinutes > FRESH_WINDOW_MINUTES) {
    return { tier: "aging", warning: "⚠️ ข้อมูลอาจเปลี่ยนแปลง" };
  }
  return { tier: "fresh", warning: null };
}

/** ร้านเปิดอยู่หรือไม่ (รองรับร้านที่ปิดหลังเที่ยงคืน) */
export function isOpenNow(openTime: string, closeTime: string, now = new Date()): boolean {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const open = minutesOfDayFromTime(openTime);
  const close = minutesOfDayFromTime(closeTime);
  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

/** ข้อความสถานะรอง: ร้านปิด / รอข้อมูล / เตือนข้อมูลเก่า */
export function statusHint(input: {
  lastUpdated: string | null | undefined;
  openTime: string;
  closeTime: string;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const fresh = statusFreshness(input.lastUpdated, input.openTime, now);
  if (fresh.tier === "expired") {
    return isOpenNow(input.openTime, input.closeTime, now) ? "⚪ รอข้อมูลล่าสุด" : "ร้านปิดอยู่";
  }
  return fresh.warning;
}
