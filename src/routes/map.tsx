import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Navigation, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RestaurantCard } from "@/components/RestaurantCard";
import { ReportStatusDialog } from "@/components/map/ReportStatusDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMyLocation, useNearbyRestaurants } from "@/hooks/use-mookrob";
import {
  CATEGORIES,
  formatDistance,
  STATUS_LABEL,
  type CategoryKey,
  type Restaurant,
  type StatusKey,
} from "@/lib/mookrob";
import { cn } from "@/lib/utils";

const MookrobMap = lazy(() => import("@/components/map/MookrobMap"));

const TITLE = "แผนที่ร้านหมูกรอบใกล้ฉัน — MooKrob Tracker";
const DESCRIPTION =
  "ค้นหาร้านหมูกรอบและร้านอาหารตามสั่งใกล้ตัวบนแผนที่ เรียงตามระยะทางจริง กรองรัศมี 1–5 กม. และดูสถานะหมูกรอบล่าสุด";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

type Filter = "all" | StatusKey;
type CategoryFilter = "all" | CategoryKey;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "available", label: `🟢 ${STATUS_LABEL.available}` },
  { key: "low", label: `🟡 ${STATUS_LABEL.low}` },
  { key: "out", label: `🔴 ${STATUS_LABEL.out}` },
  { key: "unknown", label: `⚪ ${STATUS_LABEL.unknown}` },
];

const radiusOptions: { key: number | null; label: string }[] = [
  { key: 1000, label: "1 กม." },
  { key: 3000, label: "3 กม." },
  { key: 5000, label: "5 กม." },
  { key: null, label: "ทั้งหมด" },
];

const categoryOptions: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  ...CATEGORIES.map((c) => ({ key: c as CategoryFilter, label: c })),
];

function MapSkeleton() {
  return <Skeleton className="h-80 rounded-3xl sm:h-[26rem] lg:h-[34rem]" />;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-accent-strong bg-accent-strong text-accent-strong-foreground"
          : "border-border hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function openDirections(restaurant: Restaurant) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`,
    "_blank",
    "noopener",
  );
}

function MapPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [radius, setRadius] = useState<number | null>(3000);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Restaurant | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const { location, precise, status, request } = useMyLocation();
  const { restaurants, isPending } = useNearbyRestaurants(location);
  const deniedNotified = useRef(false);

  // ผู้ใช้ไม่อนุญาตตำแหน่ง → แจ้งเตือน พร้อมให้เลือกค้นหาจากใจกลางกรุงเทพฯ
  useEffect(() => {
    if (status !== "denied" || precise || deniedNotified.current) return;
    deniedNotified.current = true;
    toast.warning("ยังไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง", {
      description: "อนุญาตตำแหน่งเพื่อดูระยะทางจริง หรือค้นหาจากพิกัดเริ่มต้น (กรุงเทพฯ)",
      duration: 10000,
      action: {
        label: "ค้นหาจากกรุงเทพฯ",
        onClick: () => setUseFallback(true),
      },
    });
  }, [status, precise]);

  const visible = useMemo(() => {
    const q = query.trim();
    return restaurants
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => (category === "all" ? true : r.category === category))
      .filter((r) => (onlyAvailable ? r.status === "available" : true))
      .filter((r) => (radius === null ? true : r.distanceKm * 1000 <= radius))
      .filter((r) => r.name.includes(q) || r.area.includes(q))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 40);
  }, [restaurants, filter, category, onlyAvailable, radius, query]);

  // พิมพ์ค้นหาแล้วเลื่อนแผนที่ไปที่ร้านที่ตรงที่สุดอัตโนมัติ
  const focusId = query.trim() && visible.length > 0 ? visible[0]!.id : activeId;
  const showMyLocation = precise || useFallback;

  return (
    <AppShell>
      <h1 className="font-display text-3xl tracking-tight">ร้านตามสั่งใกล้ฉัน</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        เรียงจากใกล้ที่สุดไปไกลที่สุด แตะหมุดหรือการ์ดร้านเพื่อดูรายละเอียด สีของหมุดคือสถานะหมูกรอบล่าสุด
      </p>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาร้านหมูกรอบ..."
          aria-label="ค้นหาร้านหมูกรอบ"
          className="h-12 rounded-full pl-11"
        />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">รัศมีค้นหา</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {radiusOptions.map((item) => (
              <Chip
                key={String(item.key)}
                active={radius === item.key}
                onClick={() => setRadius(item.key)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">ประเภทร้าน</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((item) => (
              <Chip
                key={item.key}
                active={category === item.key}
                onClick={() => setCategory(item.key)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">สถานะหมูกรอบ</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <Chip
                key={item.key}
                active={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Switch
            id="only-available"
            checked={onlyAvailable}
            onCheckedChange={setOnlyAvailable}
          />
          <Label htmlFor="only-available" className="text-sm font-medium">
            เฉพาะร้านที่ยังมีหมูกรอบ 🟢
          </Label>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <MookrobMap
              restaurants={visible}
              myLocation={location}
              precise={showMyLocation}
              radiusMeters={radius}
              focusId={focusId}
              onSelect={setActiveId}
              onReport={setReportTarget}
              onLocate={request}
            />
          </Suspense>
        </ClientOnly>

        <div>
          <p className="text-sm text-muted-foreground">
            {isPending ? "กำลังโหลดร้าน..." : `พบ ${visible.length} ร้าน`}
            {!precise && !isPending ? " (ระยะทางประมาณจากพิกัดเริ่มต้น)" : ""}
          </p>
          <div className="mt-3 space-y-3">
            {visible.map((r) => (
              <div key={r.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className="block w-full text-left"
                  aria-label={`เลื่อนแผนที่ไปที่ ${r.name}`}
                >
                  <RestaurantCard restaurant={r} />
                </button>
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-sm font-medium">
                    📍 {formatDistance(r.distanceKm)} · {r.category}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => openDirections(r)}
                  >
                    <Navigation className="size-3.5" aria-hidden />
                    นำทาง
                  </Button>
                </div>
              </div>
            ))}
            {!isPending && visible.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                ไม่พบร้านที่ตรงกับเงื่อนไข ลองขยายรัศมีหรือเปลี่ยนตัวกรอง
              </p>
            )}
          </div>
        </div>
      </div>

      <ReportStatusDialog
        restaurant={reportTarget}
        open={Boolean(reportTarget)}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
      />
    </AppShell>
  );
}
