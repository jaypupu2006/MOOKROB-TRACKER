import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Clock, Loader2, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusCard } from "@/components/StatusCard";
import { ReportButton } from "@/components/ReportButton";
import { ReportTimeline } from "@/components/ReportTimeline";
import {
  getPrecisePosition,
  haversine,
  REPORT_RADIUS_METERS,
  reportErrorMessage,
  useMyLocation,
  useSession,
  useSubmitReport,
  useToggleWatchlist,
  useWatchlistIds,
} from "@/hooks/use-mookrob";
import { getRestaurantBySlug } from "@/lib/mookrob.functions";
import {
  DEFAULT_LOCATION,
  formatDistance,
  STATUS_LABEL,
  toRestaurant,
  type StatusKey,
} from "@/lib/mookrob";
import shopFrontAsset from "@/assets/shop-front.jpg.asset.json";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/restaurant/$restaurantId")({
  loader: async ({ params }) => {
    const result = await getRestaurantBySlug({
      data: {
        slug: params.restaurantId,
        lat: DEFAULT_LOCATION.lat,
        lng: DEFAULT_LOCATION.lng,
      },
    });
    if (!result) throw notFound();
    return { restaurant: toRestaurant(result.row, { reports: result.reports }) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "ไม่พบร้าน — MooKrob Tracker" }, { name: "robots", content: "noindex" }],
      };
    }
    const { restaurant } = loaderData;
    const title = `${restaurant.name} — สถานะหมูกรอบ | MooKrob Tracker`;
    const description = `สถานะหมูกรอบล่าสุดของ${restaurant.name}: ${STATUS_LABEL[restaurant.status]} อัปเดต ${restaurant.updatedAgo} ที่ ${restaurant.area}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => (
    <AppShell>
      <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        โหลดข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        ไม่พบร้านนี้ในระบบ
      </p>
    </AppShell>
  ),
  component: RestaurantDetailPage,
});

const reportOptions: StatusKey[] = ["available", "low", "out"];

type GeoState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; lat: number; lng: number; distance: number }
  | { kind: "too-far"; distance: number }
  | { kind: "error"; message: string };

function RestaurantDetailPage() {
  const { restaurant } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<StatusKey | null>(null);
  const [geo, setGeo] = useState<GeoState>({ kind: "idle" });
  const { session } = useSession();
  const { location, precise, checking: locating, request: requestLocation } = useMyLocation();
  const watchlistIds = useWatchlistIds();
  const toggleWatchlist = useToggleWatchlist();
  const submitReport = useSubmitReport();

  const favorite = watchlistIds.has(restaurant.dbId);
  // ระยะทางจริงจากตำแหน่งของผู้ใช้ (ค่าจาก loader คำนวณจากพิกัดตั้งต้น)
  const measuredMeters =
    geo.kind === "ok" || geo.kind === "too-far"
      ? geo.distance
      : precise
        ? haversine(location.lat, location.lng, restaurant.latitude, restaurant.longitude)
        : null;
  const canReport = geo.kind === "ok";

  function requireAuth() {
    toast.error("กรุณาเข้าสู่ระบบก่อน", { description: "เข้าสู่ระบบเพื่อรายงานและบันทึกร้านโปรด" });
    void navigate({ to: "/auth" });
  }

  async function checkLocation() {
    if (!session) return requireAuth();
    setGeo({ kind: "checking" });
    try {
      const pos = await getPrecisePosition();
      const distance = haversine(pos.lat, pos.lng, restaurant.latitude, restaurant.longitude);
      if (distance > REPORT_RADIUS_METERS) {
        setGeo({ kind: "too-far", distance });
      } else {
        setGeo({ kind: "ok", lat: pos.lat, lng: pos.lng, distance });
      }
    } catch (error) {
      setGeo({
        kind: "error",
        message: error instanceof Error ? error.message : "ไม่สามารถระบุตำแหน่งของคุณได้",
      });
    }
  }

  function sendReport(status: StatusKey) {
    if (!session) return requireAuth();
    if (geo.kind !== "ok") return;
    setSelected(status);
    submitReport.mutate(
      {
        restaurantId: restaurant.dbId,
        status,
        userLat: geo.lat,
        userLng: geo.lng,
        restaurantLat: restaurant.latitude,
        restaurantLng: restaurant.longitude,
      },
      {
        onSuccess: () => {
          toast.success("ขอบคุณสำหรับข้อมูล!", {
            description: `รายงานของคุณถูกบันทึกแล้ว: ${STATUS_LABEL[status]}`,
          });
          setSelected(null);
          setGeo({ kind: "idle" });
          void router.invalidate();
        },
        onError: (error) => {
          const message = reportErrorMessage(
            error instanceof Error ? error.message : "unknown",
          );
          toast.error("ส่งรายงานไม่สำเร็จ", { description: message });
          setSelected(null);
        },
      },
    );
  }



  return (
    <AppShell>
      <Link
        to="/map"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        กลับไปที่แผนที่
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <img
          src={shopFrontAsset.url}
          alt={`หน้าร้าน${restaurant.name}`}
          width={1280}
          height={720}
          className="h-48 w-full object-cover sm:h-64 lg:h-80"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                {restaurant.name}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {restaurant.address}
              </p>
            </div>
            <button
              type="button"
              disabled={toggleWatchlist.isPending}
              onClick={() => {
                if (!session) return requireAuth();
                toggleWatchlist.mutate(
                  { restaurantId: restaurant.dbId, add: !favorite },
                  {
                    onSuccess: (added) =>
                      toast.success(
                        added ? "ติดตามร้านนี้แล้ว" : "เลิกติดตามร้านนี้แล้ว",
                        {
                          description: added
                            ? "เราจะแจ้งเตือนคุณเมื่อสถานะหมูกรอบของร้านนี้เปลี่ยน"
                            : "คุณจะไม่ได้รับการแจ้งเตือนจากร้านนี้อีก",
                        },
                      ),
                    onError: () => toast.error("บันทึกร้านโปรดไม่สำเร็จ"),
                  },
                );
              }}
              aria-pressed={favorite}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
                favorite
                  ? "border-accent-strong/40 bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary",
              )}
            >
              {toggleWatchlist.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Star
                  className={cn("size-4", favorite && "fill-accent-strong text-accent-strong")}
                  aria-hidden
                />
              )}
              <span className="hidden sm:inline">
                {favorite ? "กำลังติดตามร้านนี้" : "ติดตามร้านนี้"}
              </span>
              <span className="sm:hidden">{favorite ? "ติดตามแล้ว" : "ติดตาม"}</span>
            </button>

          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-secondary p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                เวลาเปิด–ปิด
              </dt>
              <dd className="mt-1.5 text-sm font-medium">{restaurant.hours}</dd>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
                ระยะทางจากคุณ
              </dt>
              <dd className="mt-1.5 text-sm font-medium">
                {measuredMeters === null
                  ? `~${formatDistance(restaurant.distanceKm)}`
                  : formatDistance(measuredMeters / 1000)}{" "}
                · {restaurant.area}
              </dd>
              {measuredMeters === null && (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locating}
                  className="mt-1.5 text-xs font-medium text-accent-strong underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {locating ? "กำลังหาตำแหน่ง..." : "เปิดตำแหน่งเพื่อดูระยะทางจริง"}
                </button>
              )}
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="size-3.5" aria-hidden />
                คะแนน / ราคา
              </dt>
              <dd className="mt-1.5 text-sm font-medium">
                {restaurant.rating.toFixed(1)} · {restaurant.priceRange}
              </dd>
            </div>
          </dl>

          <section className="mt-8">
            <h2 className="font-display text-2xl tracking-tight">รายงานล่าสุด</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              จากผู้ใช้ที่อยู่ที่ร้านจริงในช่วงไม่กี่ชั่วโมงที่ผ่านมา
            </p>
            <div className="mt-4">
              <ReportTimeline reports={restaurant.reports} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <StatusCard
            status={restaurant.status}
            updatedAgo={restaurant.updatedAgo}
            confidence={restaurant.confidence}
            reportCount={restaurant.reportCount}
            hint={restaurant.statusHint}
          />


          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl tracking-tight">คุณอยู่ที่ร้านนี้ไหม?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ต้องอยู่ห่างจากร้านไม่เกิน {REPORT_RADIUS_METERS} เมตรจึงจะรายงานได้
            </p>

            {geo.kind !== "ok" && (
              <button
                type="button"
                onClick={() => void checkLocation()}
                disabled={geo.kind === "checking"}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {geo.kind === "checking" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    กำลังตรวจสอบตำแหน่ง...
                  </>
                ) : (
                  <>
                    <MapPin className="size-4" aria-hidden />
                    {geo.kind === "idle" ? "ตรวจสอบตำแหน่งเพื่อรายงาน" : "ตรวจสอบตำแหน่งอีกครั้ง"}
                  </>
                )}
              </button>
            )}

            <div className="mt-3" aria-live="polite">
              {geo.kind === "checking" && (
                <p className="text-sm text-muted-foreground">กำลังตรวจสอบตำแหน่ง...</p>
              )}
              {geo.kind === "ok" && (
                <div className="rounded-xl bg-status-available-soft p-3 text-sm text-status-available">
                  <p className="font-semibold">คุณอยู่ห่างจากร้าน {geo.distance} เมตร</p>
                  <p className="mt-0.5">สามารถรายงานสถานะได้</p>
                </div>
              )}
              {geo.kind === "too-far" && (
                <div className="rounded-xl bg-status-out-soft p-3 text-sm text-status-out">
                  <p className="font-semibold">
                    คุณอยู่ห่างจากร้านเกิน {REPORT_RADIUS_METERS} เมตร (ประมาณ {geo.distance} เมตร)
                  </p>
                  <p className="mt-0.5">กรุณาไปที่ร้านก่อนจึงจะสามารถรายงานได้</p>
                </div>
              )}
              {geo.kind === "error" && (
                <div className="rounded-xl bg-status-low-soft p-3 text-sm text-status-low">
                  <p className="font-semibold">ตรวจสอบตำแหน่งไม่สำเร็จ</p>
                  <p className="mt-0.5">{geo.message}</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {reportOptions.map((status) => (
                <ReportButton
                  key={status}
                  status={status}
                  active={selected === status}
                  disabled={!canReport || submitReport.isPending}
                  onClick={() => sendReport(status)}
                />
              ))}
            </div>
            {submitReport.isPending && (
              <p className="mt-3 text-sm text-muted-foreground">กำลังส่งรายงาน...</p>
            )}
          </section>

        </div>
      </div>
    </AppShell>
  );
}
