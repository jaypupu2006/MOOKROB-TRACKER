import { cn } from "@/lib/utils";
import { STATUS_EMOJI, STATUS_LABEL, type StatusKey } from "@/lib/mookrob";

const styles: Record<StatusKey, string> = {
  available: "bg-status-available-soft text-status-available",
  low: "bg-status-low-soft text-status-low",
  out: "bg-status-out-soft text-status-out",
  unknown: "bg-status-unknown-soft text-status-unknown",
};

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: StatusKey;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium",
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-1 text-xs",
        styles[status],
        className,
      )}
    >
      <span aria-hidden>{STATUS_EMOJI[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}
