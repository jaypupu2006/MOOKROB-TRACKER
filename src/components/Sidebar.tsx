import { Link } from "@tanstack/react-router";
import { navItems } from "@/components/navigation-items";
import { STATUS_EMOJI, STATUS_LABEL, type StatusKey } from "@/lib/mookrob";

const legend: StatusKey[] = ["available", "low", "out", "unknown"];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border px-4 py-8 lg:block">
      <nav aria-label="เมนูหลัก">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                <item.icon className="size-4.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 rounded-2xl bg-secondary p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          ความหมายของสี
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {legend.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span aria-hidden>{STATUS_EMOJI[status]}</span>
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
