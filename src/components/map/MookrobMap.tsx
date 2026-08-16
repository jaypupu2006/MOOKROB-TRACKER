import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Crosshair, Navigation } from "lucide-react";
import type { Marker as LeafletMarker } from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import shopFrontAsset from "@/assets/shop-front.jpg.asset.json";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { createMyLocationIcon, createStatusIcon } from "@/components/map/markers";
import { formatDistance, type Restaurant } from "@/lib/mookrob";

const BANGKOK: [number, number] = [13.7563, 100.5018];

function FlyTo({ target, zoom }: { target: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, zoom, { duration: 0.8 });
  }, [target?.[0], target?.[1], zoom]);
  return null;
}

export type MookrobMapProps = {
  restaurants: Restaurant[];
  myLocation: { lat: number; lng: number };
  precise: boolean;
  /** รัศมีค้นหาที่เลือกไว้ (เมตร) — ใช้วาดวงกลมรอบตัวผู้ใช้ */
  radiusMeters: number | null;
  focusId: string | null;
  onSelect: (id: string) => void;
  onReport: (restaurant: Restaurant) => void;
  onLocate: () => void;
};

export default function MookrobMap({
  restaurants,
  myLocation,
  precise,
  radiusMeters,
  focusId,
  onSelect,
  onReport,
  onLocate,
}: MookrobMapProps) {
  const markers = useRef<Record<string, LeafletMarker | null>>({});
  const focused = restaurants.find((r) => r.id === focusId) ?? null;
  const center: [number, number] = precise ? [myLocation.lat, myLocation.lng] : BANGKOK;

  useEffect(() => {
    if (!focusId) return;
    const marker = markers.current[focusId];
    const timer = window.setTimeout(() => marker?.openPopup(), 500);
    return () => window.clearTimeout(timer);
  }, [focusId]);

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border border-border sm:h-[26rem] lg:h-[34rem]">
      <MapContainer
        center={center}
        zoom={precise ? 15 : 13}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "var(--secondary)" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <FlyTo
          target={focused ? [focused.latitude, focused.longitude] : null}
          zoom={16}
        />

        {precise && (
          <>
            <Circle
              center={[myLocation.lat, myLocation.lng]}
              radius={radiusMeters ?? 100}
              pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.15 }}
            />
            <Marker position={[myLocation.lat, myLocation.lng]} icon={createMyLocationIcon()}>
              <Popup>คุณอยู่ที่นี่</Popup>
            </Marker>
          </>
        )}

        {restaurants.map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={createStatusIcon(r.status, r.id === focusId)}
            ref={(instance) => {
              markers.current[r.id] = instance;
            }}
            eventHandlers={{ click: () => onSelect(r.id) }}
          >
            <Popup minWidth={232}>
              <div className="w-56 space-y-2">
                <img
                  src={shopFrontAsset.url}
                  alt={`ร้าน${r.name}`}
                  loading="lazy"
                  className="h-24 w-full rounded-xl object-cover"
                />
                <p className="font-display text-base leading-tight tracking-tight">{r.name}</p>
                <StatusBadge status={r.status} />
                <p className="!m-0 text-xs text-muted-foreground">
                  อัปเดต {r.updatedAgo} · ห่างจากคุณ {formatDistance(r.distanceKm)}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => onReport(r)}>
                    อัปเดตสถานะ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}`,
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    <Navigation className="size-3.5" aria-hidden />
                    นำทาง
                  </Button>
                </div>
                <Link
                  to="/restaurant/$restaurantId"
                  params={{ restaurantId: r.id }}
                  className="block text-xs font-medium text-primary underline"
                >
                  ดูรายละเอียดร้าน
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={onLocate}
        title="ตำแหน่งของฉัน"
        aria-label="ตำแหน่งของฉัน"
        className="absolute bottom-9 right-4 z-[500] flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-lg transition-colors hover:bg-secondary"
      >
        <Crosshair className="size-4" aria-hidden />
        ตำแหน่งของฉัน
      </button>
    </div>
  );
}
