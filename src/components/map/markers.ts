import L from "leaflet";
import type { StatusKey } from "@/lib/mookrob";

/** สีหมุดอ้างอิง token --status-* ใน src/styles.css */
const STATUS_VAR: Record<StatusKey, string> = {
  available: "var(--status-available)",
  low: "var(--status-low)",
  out: "var(--status-out)",
  unknown: "var(--status-unknown)",
};

/** หมุดร้าน: วาด SVG เองทั้งหมด จึงไม่ต้องพึ่ง marker-icon.png ของ Leaflet */
export function createStatusIcon(status: StatusKey, active = false) {
  const color = STATUS_VAR[status];
  const scale = active ? 1.2 : 1;
  const w = Math.round(30 * scale);
  const h = Math.round(40 * scale);
  return L.divIcon({
    className: "mookrob-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))">
      <path d="M15 39C15 39 28 24.4 28 14.7 28 6.6 22.2 1 15 1S2 6.6 2 14.7C2 24.4 15 39 15 39Z"
        fill="${color}" stroke="white" stroke-width="2" />
      <circle cx="15" cy="14.5" r="4.6" fill="white" fill-opacity="0.95" />
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

/** หมุด "คุณอยู่ที่นี่" สีน้ำเงิน */
export function createMyLocationIcon() {
  return L.divIcon({
    className: "mookrob-pin",
    html: `<span class="mookrob-my-location"><span class="mookrob-my-location-pulse"></span><span class="mookrob-my-location-dot"></span></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}
