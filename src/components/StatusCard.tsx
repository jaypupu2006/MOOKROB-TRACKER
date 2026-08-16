import { Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_EMOJI, STATUS_LABEL, type StatusKey } from "@/lib/mookrob";
import { Progress } from "@/components/ui/progress";

const ring: Record<StatusKey, string> = {
  available: "border-status-available/30 bg-status-available-soft",
  low: "border-status-low/30 bg-status-low-soft",
  out: "border-status-out/30 bg-status-out-soft",
  unknown: "border-status-unknown/30 bg-status-unknown-soft",
};

const text: Record<StatusKey, string> = {
  available: "text-status-available",
  low: "text-status-low",
  out: "text-status-out",
  unknown: "text-status-unknown",
};

export function StatusCard({
  status,
  updatedAgo,
  confidence,
  hint,
  reportCount,
  className,
}: {
  status: StatusKey;
  updatedAgo: string;
  confidence: number;
  hint?: string | null;
  reportCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-5 sm:p-6", ring[status], className)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        สถานะล่าสุด
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {STATUS_EMOJI[status]}
        </span>
        <span className={cn("font-display text-3xl tracking-tight sm:text-4xl", text[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 shrink-0" aria-hidden />
          อัปเดต {updatedAgo}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          ความมั่นใจ {confidence}%
        </span>
        {typeof reportCount === "number" && reportCount > 0 ? (
          <span>จาก {reportCount} รายงาน</span>
        ) : null}
      </div>

      <Progress value={confidence} className="mt-4 h-2" />
    </div>
  );
}

