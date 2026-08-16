import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { useProfile } from "@/hooks/use-mookrob";

export function Header() {
  const { profile, session } = useProfile();
  const initials = profile?.username?.slice(0, 2) ?? (session ? "ผู้" : "เข้า");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-strong text-lg">
            🥓
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg leading-tight tracking-tight">
              MooKrob Tracker
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              เช็กหมูกรอบก่อนออกจากบ้าน
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <Link to={session ? "/profile" : "/auth"} aria-label="โปรไฟล์ของฉัน">
            <Avatar className="size-9">
              <AvatarFallback className="bg-secondary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}
