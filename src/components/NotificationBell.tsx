import { Link } from "@tanstack/react-router";
import { Bell, BellOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS_EMOJI } from "@/lib/mookrob";
import { useMarkNotificationsRead, useNotifications, useSession } from "@/hooks/use-mookrob";
import { cn } from "@/lib/utils";

/** กระดิ่งแจ้งเตือน — แสดงเฉพาะเมื่อสถานะร้านที่ติดตามเปลี่ยนจริง */
export function NotificationBell() {
  const { session } = useSession();
  const { data: notifications, isPending } = useNotifications();
  const markRead = useMarkNotificationsRead();

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  if (!session) {
    return (
      <Link
        to="/auth"
        aria-label="เข้าสู่ระบบเพื่อรับการแจ้งเตือน"
        className="grid size-9 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
      >
        <Bell className="size-4" aria-hidden />
      </Link>
    );
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread > 0) markRead.mutate();
      }}
    >
      <PopoverTrigger
        aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
        className="relative grid size-9 place-items-center rounded-full border border-border transition-colors hover:bg-secondary"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-status-out px-1 text-[10px] font-semibold leading-4 text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-display text-base tracking-tight">การแจ้งเตือน</p>
          <p className="text-xs text-muted-foreground">
            แจ้งเมื่อสถานะหมูกรอบของร้านที่คุณติดตามเปลี่ยน
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isPending && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          )}

          {!isPending && items.length === 0 && (
            <div className="px-4 py-8 text-center">
              <BellOff className="mx-auto size-5 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">
                ยังไม่มีการแจ้งเตือน — ติดตามร้านโปรดไว้ เราจะบอกคุณทันทีที่สถานะเปลี่ยน
              </p>
            </div>
          )}

          <ul>
            {items.map((item) => {
              const content = (
                <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <span aria-hidden className="text-base leading-6">
                    {STATUS_EMOJI[item.to_status]}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm leading-snug",
                        !item.read_at && "font-semibold",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {item.timeAgo}
                    </span>
                  </span>
                </span>
              );

              return (
                <li key={item.id} className="border-b border-border last:border-0">
                  {item.restaurantSlug ? (
                    <Link
                      to="/restaurant/$restaurantId"
                      params={{ restaurantId: item.restaurantSlug }}
                      className="block px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <Link
          to="/watchlist"
          className="block border-t border-border px-4 py-3 text-center text-sm font-medium text-accent-strong"
        >
          จัดการร้านโปรดและการแจ้งเตือน
        </Link>
      </PopoverContent>
    </Popover>
  );
}
