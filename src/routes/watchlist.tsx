import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Bell, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RestaurantCard } from "@/components/RestaurantCard";
import { WatchlistItem } from "@/components/WatchlistItem";
import {
  useMyLocation,
  useNearbyRestaurants,
  useSession,
  useWatchlist,
  watchlistToRestaurants,
} from "@/hooks/use-mookrob";

const TITLE = "ร้านโปรดของฉัน — MooKrob Tracker";
const DESCRIPTION =
  "รวมร้านหมูกรอบที่คุณติดตาม ดูสถานะล่าสุดของทุกร้านโปรดได้ในหน้าเดียว ก่อนออกเดินทาง";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { session } = useSession();
  const { location } = useMyLocation();
  const { data: rows, isPending, isError, refetch } = useWatchlist();
  const { restaurants } = useNearbyRestaurants(location);

  const items = (rows ?? [])
    .filter((row) => row.restaurants)
    .map((row) => ({
      row,
      restaurant: watchlistToRestaurants([row], location)[0]!,
    }))
    .sort((a, b) => a.restaurant.distanceKm - b.restaurant.distanceKm);

  const favoriteIds = new Set(items.map((item) => item.restaurant.dbId));
  const notifyCount = items.filter((item) => item.row.notifications_enabled).length;
  const availableCount = items.filter((item) => item.restaurant.status === "available").length;
  const suggestions = restaurants
    .filter((r) => !favoriteIds.has(r.dbId) && r.status === "available")
    .slice(0, 3);

  return (
    <AppShell>
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">ร้านโปรดของฉัน</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {session
          ? `ติดตาม ${items.length} ร้าน · เปิดแจ้งเตือน ${notifyCount} ร้าน — เราจะเตือนเฉพาะเมื่อสถานะหมูกรอบเปลี่ยนจริง`
          : "เข้าสู่ระบบเพื่อบันทึกร้านโปรดและรับการแจ้งเตือนสถานะหมูกรอบ"}
      </p>

      {!session && (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center sm:p-10">
          <Star className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">
            ยังไม่ได้เข้าสู่ระบบ — เข้าสู่ระบบเพื่อเริ่มติดตามร้านหมูกรอบที่คุณชอบ
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-flex items-center rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-strong-foreground"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {session && (
        <>
          {items.length > 0 && (
            <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
              <Bell className="size-4 shrink-0" aria-hidden />
              <p className="min-w-0">
                {availableCount > 0
                  ? `ตอนนี้มีหมูกรอบ ${availableCount} ร้านจากร้านโปรดของคุณ — รู้ก่อนออกไปกิน`
                  : "ยังไม่มีร้านโปรดที่ยืนยันว่ามีหมูกรอบในขณะนี้"}
              </p>
            </div>
          )}

          {isError && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
              <AlertCircle className="size-6 text-status-out" aria-hidden />
              <p className="text-sm text-muted-foreground">
                โหลดร้านโปรดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {isPending &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl border border-border bg-secondary"
                />
              ))}
            {items.map((item) => (
              <WatchlistItem
                key={item.row.id}
                watchlistId={item.row.id}
                restaurant={item.restaurant}
                notificationsEnabled={item.row.notifications_enabled}
              />
            ))}
          </div>

          {!isPending && !isError && items.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center sm:p-10">
              <Star className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                ยังไม่มีร้านโปรด — กด “ติดตามร้านนี้” ที่หน้าร้านเพื่อเพิ่มเข้ามาได้เลย
              </p>
              <Link
                to="/map"
                className="mt-5 inline-flex items-center rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-strong-foreground"
              >
                หาร้านใกล้ฉัน
              </Link>
            </div>
          )}
        </>
      )}

      {suggestions.length > 0 && (
        <section className="mt-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <h2 className="truncate font-display text-2xl tracking-tight">ร้านที่คุณน่าจะชอบ</h2>
            <Link to="/map" className="shrink-0 text-sm font-medium text-accent-strong">
              ดูทั้งหมด
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
