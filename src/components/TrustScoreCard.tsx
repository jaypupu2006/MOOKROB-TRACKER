import { Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  REPORTER_BADGES,
  accuracyPercent,
  currentBadge,
  isBadgeEarned,
  nextBadgeProgress,
  reporterLevel,
  type ProfileStats,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

export function TrustScoreCard({ stats, loading }: { stats: ProfileStats; loading?: boolean }) {
  const accuracy = accuracyPercent(stats);
  const badge = currentBadge(stats);
  const { next, percent, requirement } = nextBadgeProgress(stats);
  const level = reporterLevel(stats);

  const rows = [
    { label: "รายงานทั้งหมด", value: `${stats.totalReports} ครั้ง` },
    { label: "รายงานที่ถูกต้อง", value: `${stats.accurateReports} ครั้ง` },
    { label: "ความแม่นยำ", value: `${accuracy}%` },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">คะแนนความน่าเชื่อถือ</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        คำนวณจากความแม่นยำของรายงานที่คุณส่งเข้ามา — คะแนนสูงทำให้รายงานของคุณมีน้ำหนักมากขึ้น
      </p>

      <div className="mt-6 flex items-end gap-3">
        <span
          className={cn(
            "font-display text-6xl leading-none tracking-tight text-accent-strong",
            loading && "animate-pulse opacity-50",
          )}
        >
          {stats.trustScore}
        </span>
        <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
      </div>
      <Progress
        value={stats.trustScore}
        aria-label="คะแนนความน่าเชื่อถือ"
        className="mt-4 h-2.5"
      />

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-secondary p-4">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 font-display text-2xl tracking-tight">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent-strong/30 bg-accent p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-strong text-accent-strong-foreground">
          <Award className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-accent-foreground">
            {badge.emoji} {badge.label}
          </p>
          <p className="text-xs leading-snug text-accent-foreground/70">{badge.note}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">เหรียญตราผู้รายงาน</h3>
          <p className="text-xs text-muted-foreground">
            ระดับ {level.level} · {level.points} แต้ม
          </p>
        </div>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {REPORTER_BADGES.map((item) => {
            const earned = isBadgeEarned(item, stats);
            return (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  earned ? "border-accent-strong/30 bg-accent/50" : "border-dashed border-border",
                )}
              >
                <span
                  aria-hidden
                  className={cn("text-xl", !earned && "opacity-40 grayscale")}
                >
                  {item.emoji}
                </span>
                <div className="min-w-0">
                  <p className={cn("truncate text-sm", earned ? "font-semibold" : "text-muted-foreground")}>
                    {item.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {earned
                      ? "ปลดล็อกแล้ว"
                      : `ต้องมี ${item.minTrust} คะแนน · ${item.minReports} รายงาน`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 rounded-2xl bg-secondary p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {next ? `เหรียญตราถัดไป: ${next.label}` : "ปลดล็อกครบทุกเหรียญตราแล้ว 🎉"}
            </p>
            <p className="text-xs text-muted-foreground">{percent}%</p>
          </div>
          <Progress value={percent} aria-label="ความคืบหน้าเหรียญตราถัดไป" className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">{requirement}</p>
        </div>
      </div>
    </section>
  );
}
