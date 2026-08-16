import { StatusBadge } from "@/components/StatusBadge";
import type { Report } from "@/lib/mookrob";

export function ReportTimeline({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        ยังไม่มีรายงานจากผู้ใช้ในวันนี้ — เป็นคนแรกที่ช่วยรายงานได้เลย
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {reports.map((report) => (
        <li key={report.id} className="relative border-l border-border pl-5 pb-1 last:pb-0">
          <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-accent-strong" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="truncate text-sm font-medium">{report.user}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{report.timeAgo}</p>
          {report.note && <p className="mt-1.5 text-sm text-foreground/80">{report.note}</p>}
        </li>
      ))}
    </ol>
  );
}
