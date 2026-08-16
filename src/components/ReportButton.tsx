import { cn } from "@/lib/utils";
import { STATUS_EMOJI, type StatusKey } from "@/lib/mookrob";

const styles: Record<StatusKey, string> = {
  available:
    "border-status-available/40 bg-status-available-soft text-status-available hover:bg-status-available/15",
  low: "border-status-low/40 bg-status-low-soft text-status-low hover:bg-status-low/15",
  out: "border-status-out/40 bg-status-out-soft text-status-out hover:bg-status-out/15",
  unknown:
    "border-status-unknown/40 bg-status-unknown-soft text-status-unknown hover:bg-status-unknown/15",
};

const shortLabel: Record<StatusKey, string> = {
  available: "มี",
  low: "เหลือน้อย",
  out: "หมดแล้ว",
  unknown: "ไม่แน่ใจ",
};

export function ReportButton({
  status,
  active,
  onClick,
  className,
  disabled,
}: {
  status: StatusKey;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
        styles[status],
        disabled && "cursor-not-allowed opacity-50",
        active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <span aria-hidden>{STATUS_EMOJI[status]}</span>
      {shortLabel[status]}
    </button>
  );
}
