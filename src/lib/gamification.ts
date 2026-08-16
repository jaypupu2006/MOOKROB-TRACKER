/**
 * ระบบเหรียญตราและแรงจูงใจของผู้รายงาน (คำนวณจากข้อมูลจริงในโปรไฟล์)
 * ไม่มีการเขียนค่าใด ๆ กลับเข้าฐานข้อมูลจากฝั่งหน้าเว็บ
 */

export type ReporterBadge = {
  key: "new" | "regular" | "trusted" | "elite";
  label: string;
  note: string;
  emoji: string;
  minTrust: number;
  minReports: number;
};

export const REPORTER_BADGES: ReporterBadge[] = [
  {
    key: "new",
    label: "ผู้รายงานใหม่",
    note: "เพิ่งเริ่มต้น — ส่งรายงานเพื่อสะสมความน่าเชื่อถือ",
    emoji: "🌱",
    minTrust: 0,
    minReports: 0,
  },
  {
    key: "regular",
    label: "ผู้รายงานทั่วไป",
    note: "รายงานสม่ำเสมอ เพื่อน ๆ เริ่มพึ่งพาข้อมูลของคุณ",
    emoji: "🥓",
    minTrust: 30,
    minReports: 5,
  },
  {
    key: "trusted",
    label: "ผู้รายงานที่น่าเชื่อถือ",
    note: "รายงานของคุณมีน้ำหนักสูงในการคำนวณสถานะ",
    emoji: "🛡️",
    minTrust: 60,
    minReports: 15,
  },
  {
    key: "elite",
    label: "ผู้รายงานยอดเยี่ยม",
    note: "แม่นยำต่อเนื่อง — ระดับสูงสุดของ MooKrob Tracker",
    emoji: "👑",
    minTrust: 85,
    minReports: 40,
  },
];

export type ProfileStats = {
  trustScore: number;
  totalReports: number;
  accurateReports: number;
};

export function accuracyPercent({ totalReports, accurateReports }: ProfileStats) {
  if (totalReports <= 0) return 0;
  return Math.round((accurateReports / totalReports) * 100);
}

/** เหรียญตราสูงสุดที่ปลดล็อกได้แล้ว */
export function currentBadge(stats: ProfileStats): ReporterBadge {
  let earned = REPORTER_BADGES[0]!;
  for (const badge of REPORTER_BADGES) {
    if (stats.trustScore >= badge.minTrust && stats.totalReports >= badge.minReports) {
      earned = badge;
    }
  }
  return earned;
}

export function isBadgeEarned(badge: ReporterBadge, stats: ProfileStats) {
  return stats.trustScore >= badge.minTrust && stats.totalReports >= badge.minReports;
}

/** เหรียญตราถัดไปพร้อมความคืบหน้า (0–100) และสิ่งที่ยังขาด */
export function nextBadgeProgress(stats: ProfileStats): {
  next: ReporterBadge | null;
  percent: number;
  requirement: string;
} {
  const next = REPORTER_BADGES.find((badge) => !isBadgeEarned(badge, stats)) ?? null;
  if (!next) return { next: null, percent: 100, requirement: "ปลดล็อกครบทุกเหรียญตราแล้ว" };

  const trustRatio = next.minTrust > 0 ? Math.min(1, stats.trustScore / next.minTrust) : 1;
  const reportRatio = next.minReports > 0 ? Math.min(1, stats.totalReports / next.minReports) : 1;
  const percent = Math.round(((trustRatio + reportRatio) / 2) * 100);

  const missing: string[] = [];
  if (stats.trustScore < next.minTrust) {
    missing.push(`คะแนนความน่าเชื่อถืออีก ${next.minTrust - stats.trustScore} คะแนน`);
  }
  if (stats.totalReports < next.minReports) {
    missing.push(`รายงานอีก ${next.minReports - stats.totalReports} ครั้ง`);
  }

  return {
    next,
    percent,
    requirement: missing.length > 0 ? `ต้องการ${missing.join(" และ ")}` : "ใกล้ปลดล็อกแล้ว",
  };
}

/** คะแนนสะสมและระดับ (ใช้เพื่อสร้างแรงจูงใจในการรายงาน) */
export function reporterLevel(stats: ProfileStats) {
  const points = stats.totalReports * 10 + stats.accurateReports * 15;
  const level = Math.max(1, Math.floor(points / 150) + 1);
  const pointsInLevel = points % 150;
  return { points, level, pointsInLevel, pointsToNext: 150 - pointsInLevel };
}
