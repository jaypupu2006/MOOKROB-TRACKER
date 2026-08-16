import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useMyLocation, useNearbyRestaurants } from "@/hooks/use-mookrob";
import { STATUS_LABEL, type StatusKey } from "@/lib/mookrob";
import heroAsset from "@/assets/mookrob-hero.jpg.asset.json";

const heroImage = heroAsset.url;

const TITLE = "MooKrob Tracker — เช็กสถานะหมูกรอบก่อนออกไป";
const DESCRIPTION =
  "ดูสถานะหมูกรอบจากคนที่อยู่ที่ร้านจริง ก่อนเสียเวลาเดินทาง พร้อมแผนที่ร้านใกล้คุณและรายงานสด";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: HomePage,
});

const meterOrder: StatusKey[] = ["available", "low", "out", "unknown"];

const meterColor: Record<StatusKey, string> = {
  available: "bg-status-available",
  low: "bg-status-low",
  out: "bg-status-out",
  unknown: "bg-status-unknown",
};

function HomePage() {
  const { location, precise, checking, request } = useMyLocation();
  const { restaurants, isPending } = useNearbyRestaurants(location);

  const nearby = [...restaurants].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 12);
  const counts = meterOrder.map((status) => ({
    status,
    count: restaurants.filter((r) => r.status === status).length,
  }));

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <TrendingUp className="size-3.5" aria-hidden />
              MooKrob Tracker
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl">
              อยากกินหมูกรอบ?
              <br />
              <span className="text-accent-strong">เช็กก่อนออกไป</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              ดูสถานะหมูกรอบจากคนที่อยู่ที่ร้านจริง ก่อนเสียเวลาเดินทาง
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={request}
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-strong-foreground transition-opacity hover:opacity-90"
              >
                <MapPin className="size-4" aria-hidden />
                {checking
                  ? "📍 กำลังหาตำแหน่ง..."
                  : precise
                    ? "📍 ใช้ตำแหน่งปัจจุบันแล้ว"
                    : "📍 ใช้ตำแหน่งของฉัน"}
              </button>
              <Link
                to="/watchlist"
                className="inline-flex items-center rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                ร้านโปรดของฉัน
              </Link>
            </div>
          </div>

          <div className="relative min-h-52 lg:min-h-full">
            <img
              src={heroImage}
              alt="หมูกรอบหนังกรอบเสิร์ฟพร้อมข้าวสวยและน้ำจิ้ม"
              width={1280}
              height={800}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border p-5 sm:p-6">
        <h2 className="font-display text-xl tracking-tight">MooKrob Tracker วันนี้</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPending
            ? "กำลังโหลดสถานะร้านหมูกรอบ..."
            : `สรุปสถานะร้านหมูกรอบ ${restaurants.length} ร้านในรัศมี 15 กิโลเมตร`}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map(({ status, count }) => (
            <div key={status} className="rounded-2xl bg-secondary p-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`size-2.5 rounded-full ${meterColor[status]}`} aria-hidden />
                {STATUS_LABEL[status]}
              </dt>
              <dd className="mt-2 font-display text-3xl tracking-tight">{count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <h2 className="truncate font-display text-2xl tracking-tight">ร้านใกล้ฉัน</h2>
          <Link to="/map" className="shrink-0 text-sm font-medium text-accent-strong">
            ดูบนแผนที่
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isPending &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-secondary" />
            ))}
          {nearby.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
