import { Link } from "@tanstack/react-router";
import { Bell, BellOff, Clock, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { Switch } from "@/components/ui/switch";
import { formatDistance, type Restaurant } from "@/lib/mookrob";
import {
  useMyLocation,
  useToggleWatchlist,
  useToggleWatchlistNotifications,
} from "@/hooks/use-mookrob";

/** การ์ดร้านโปรด: สถานะล่าสุด อัปเดตเมื่อไร และสวิตช์แจ้งเตือน */
export function WatchlistItem({
  watchlistId,
  restaurant,
  notificationsEnabled,
}: {
  watchlistId: string;
  restaurant: Restaurant;
  notificationsEnabled: boolean;
}) {
  const { precise } = useMyLocation();
  const toggleNotifications = useToggleWatchlistNotifications();
  const toggleWatchlist = useToggleWatchlist();
  const switchId = `notify-${watchlistId}`;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <Link
            to="/restaurant/$restaurantId"
            params={{ restaurantId: restaurant.id }}
            className="block truncate font-display text-xl tracking-tight hover:text-accent-strong"
          >
            {restaurant.name}
          </Link>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {restaurant.area} · {restaurant.priceRange}
          </p>
        </div>
        <StatusBadge status={restaurant.status} />
      </div>

      {restaurant.statusHint && (
        <p className="mt-2 text-xs text-muted-foreground">{restaurant.statusHint}</p>
      )}

      <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Clock className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">อัปเดตล่าสุด</dt>
          <dd>อัปเดต {restaurant.updatedAgo}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">ระยะทางจากคุณ</dt>
          <dd>
            {precise ? "" : "~"}
            {formatDistance(restaurant.distanceKm)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <label htmlFor={switchId} className="flex min-w-0 items-center gap-2 text-sm">
          {notificationsEnabled ? (
            <Bell className="size-4 shrink-0 text-accent-strong" aria-hidden />
          ) : (
            <BellOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="truncate">
            {notificationsEnabled ? "แจ้งเตือนเมื่อสถานะเปลี่ยน" : "ปิดการแจ้งเตือนอยู่"}
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-3">
          <Switch
            id={switchId}
            checked={notificationsEnabled}
            disabled={toggleNotifications.isPending}
            onCheckedChange={(next) =>
              toggleNotifications.mutate(
                { id: watchlistId, enabled: next },
                {
                  onSuccess: (enabled) =>
                    toast.success(enabled ? "เปิดการแจ้งเตือนแล้ว" : "ปิดการแจ้งเตือนแล้ว"),
                  onError: () => toast.error("ปรับการแจ้งเตือนไม่สำเร็จ"),
                },
              )
            }
          />
          <button
            type="button"
            aria-label={`เลิกติดตาม${restaurant.name}`}
            disabled={toggleWatchlist.isPending}
            onClick={() =>
              toggleWatchlist.mutate(
                { restaurantId: restaurant.dbId, add: false },
                {
                  onSuccess: () => toast.success("นำออกจากร้านโปรดแล้ว"),
                  onError: () => toast.error("นำออกจากร้านโปรดไม่สำเร็จ"),
                },
              )
            }
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
