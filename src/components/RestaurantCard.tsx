import { Link } from "@tanstack/react-router";
import { Clock, MapPin, ShieldCheck, Star } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDistance, type Restaurant } from "@/lib/mookrob";
import { useMyLocation } from "@/hooks/use-mookrob";
import { cn } from "@/lib/utils";

export function RestaurantCard({
  restaurant,
  className,
}: {
  restaurant: Restaurant;
  className?: string;
}) {
  const { precise } = useMyLocation();

  return (
    <Link
      to="/restaurant/$restaurantId"
      params={{ restaurantId: restaurant.id }}
      className={cn(
        "block rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:p-5",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl tracking-tight">{restaurant.name}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {restaurant.area} · {restaurant.priceRange}
          </p>
        </div>
        <StatusBadge status={restaurant.status} />
      </div>
      {restaurant.statusHint ? (
        <p className="mt-2 text-xs text-muted-foreground">{restaurant.statusHint}</p>
      ) : null}


      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">ระยะทางจากคุณ</dt>
          <dd title={precise ? "ระยะทางจากตำแหน่งจริงของคุณ" : "เปิดตำแหน่งเพื่อดูระยะทางจริง"}>
            {precise ? "" : "~"}
            {formatDistance(restaurant.distanceKm)}
          </dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Clock className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">อัปเดตล่าสุด</dt>
          <dd>{restaurant.updatedAgo}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">ความมั่นใจ</dt>
          <dd>
            {restaurant.confidence > 0 ? `ความมั่นใจ ${restaurant.confidence}%` : "ยังไม่มีรายงาน"}
          </dd>

        </div>
        <div className="inline-flex items-center gap-1.5">
          <Star className="size-4 shrink-0" aria-hidden />
          <dt className="sr-only">คะแนนร้าน</dt>
          <dd>{restaurant.rating.toFixed(1)}</dd>
        </div>
      </dl>
    </Link>
  );
}
