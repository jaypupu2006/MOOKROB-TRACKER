/**
 * ที่เก็บตำแหน่งของผู้ใช้แบบใช้ร่วมกันทั้งแอป
 * - ขอ GPS อัตโนมัติครั้งแรกที่มีหน้าเรียกใช้
 * - จำพิกัดล่าสุดไว้ใน localStorage เพื่อให้ทุกหน้าใช้ตำแหน่งจริงชุดเดียวกัน
 */

import { DEFAULT_LOCATION } from "./mookrob";

export type LatLng = { lat: number; lng: number };

export type LocationStatus = "idle" | "checking" | "granted" | "denied";

export type UserLocationState = {
  location: LatLng;
  /** true = พิกัดจริงจาก GPS ของผู้ใช้ */
  precise: boolean;
  status: LocationStatus;
  /** เวลาที่ได้พิกัดล่าสุด (epoch ms) */
  updatedAt: number | null;
};

const STORAGE_KEY = "mookrob:my-location";

const initialState: UserLocationState = {
  location: DEFAULT_LOCATION,
  precise: false,
  status: "idle",
  updatedAt: null,
};

let state: UserLocationState = initialState;
let hydrated = false;
let requestInFlight = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: Partial<UserLocationState>) {
  state = { ...state, ...next };
  emit();
}

function isValid(lat: number, lng: number) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; updatedAt: number };
    if (!isValid(parsed.lat, parsed.lng)) return;
    state = {
      location: { lat: parsed.lat, lng: parsed.lng },
      precise: true,
      status: "granted",
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    // ไม่ต้องทำอะไร ใช้ค่าตั้งต้นต่อไป
  }
}

function persist(location: LatLng, updatedAt: number) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: location.lat, lng: location.lng, updatedAt }),
    );
  } catch {
    // localStorage ใช้ไม่ได้ (โหมดส่วนตัว) — ข้ามไป
  }
}

/** ขอพิกัด GPS แล้วอัปเดตที่เก็บกลาง */
export function requestUserLocation(options?: { force?: boolean }) {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  if (requestInFlight) return;
  if (!options?.force && state.precise && state.updatedAt && Date.now() - state.updatedAt < 60_000) {
    return;
  }

  requestInFlight = true;
  setState({ status: "checking" });
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      requestInFlight = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!isValid(lat, lng)) {
        setState({ status: "denied" });
        return;
      }
      const updatedAt = Date.now();
      persist({ lat, lng }, updatedAt);
      setState({ location: { lat, lng }, precise: true, status: "granted", updatedAt });
    },
    () => {
      requestInFlight = false;
      setState({ status: state.precise ? "granted" : "denied" });
    },
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
  );
}

export function subscribeUserLocation(listener: () => void) {
  hydrateFromStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUserLocationSnapshot(): UserLocationState {
  hydrateFromStorage();
  return state;
}

export function getUserLocationServerSnapshot(): UserLocationState {
  return initialState;
}
