import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import {
  REPORT_RADIUS_METERS,
  getPrecisePosition,
  haversine,
  reportErrorMessage,
  useSession,
  useSubmitReport,
} from "@/hooks/use-mookrob";
import { STATUS_LABEL, type Restaurant, type StatusKey } from "@/lib/mookrob";
import { cn } from "@/lib/utils";

const OPTIONS: StatusKey[] = ["available", "low", "out", "unknown"];

type GeoState =
  | { phase: "checking" }
  | { phase: "ok"; lat: number; lng: number; distance: number }
  | { phase: "too_far"; distance: number }
  | { phase: "error"; message: string };

export function ReportStatusDialog({
  restaurant,
  open,
  onOpenChange,
}: {
  restaurant: Restaurant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useSession();
  const submit = useSubmitReport();
  const [geo, setGeo] = useState<GeoState>({ phase: "checking" });
  const [status, setStatus] = useState<StatusKey>("available");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !restaurant) return;
    let cancelled = false;
    setGeo({ phase: "checking" });
    setNote("");
    setStatus("available");
    getPrecisePosition()
      .then((pos) => {
        if (cancelled) return;
        const distance = haversine(pos.lat, pos.lng, restaurant.latitude, restaurant.longitude);
        setGeo(
          distance <= REPORT_RADIUS_METERS
            ? { phase: "ok", lat: pos.lat, lng: pos.lng, distance }
            : { phase: "too_far", distance },
        );
      })
      .catch((err: Error) => {
        if (!cancelled) setGeo({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [open, restaurant?.dbId]);

  const canSubmit = Boolean(session) && geo.phase === "ok" && !submit.isPending;

  async function handleSubmit() {
    if (!restaurant || geo.phase !== "ok") return;
    try {
      await submit.mutateAsync({
        restaurantId: restaurant.dbId,
        status,
        userLat: geo.lat,
        userLng: geo.lng,
        restaurantLat: restaurant.latitude,
        restaurantLng: restaurant.longitude,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success("ขอบคุณสำหรับข้อมูล!", { description: "รายงานของคุณถูกบันทึกแล้ว" });
      onOpenChange(false);
    } catch (err) {
      toast.error(reportErrorMessage((err as Error).message));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">อัปเดตสถานะหมูกรอบ</DialogTitle>
          <DialogDescription>
            {restaurant ? restaurant.name : "เลือกร้าน"} — รายงานได้เมื่ออยู่ในระยะ{" "}
            {REPORT_RADIUS_METERS} เมตรจากร้าน
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-sm">
          {geo.phase === "checking" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              กำลังตรวจสอบตำแหน่งของคุณ...
            </p>
          )}
          {geo.phase === "ok" && (
            <p className="flex items-center gap-2 text-status-available">
              <MapPin className="size-4" aria-hidden />
              คุณอยู่ห่างจากร้าน {geo.distance} เมตร — รายงานได้
            </p>
          )}
          {geo.phase === "too_far" && (
            <p className="text-status-out">
              คุณอยู่ห่างจากร้าน {geo.distance} เมตร (เกิน {REPORT_RADIUS_METERS} เมตร)
              จึงยังรายงานไม่ได้
            </p>
          )}
          {geo.phase === "error" && <p className="text-status-out">{geo.message}</p>}
          {!session && (
            <p className="mt-2 text-muted-foreground">
              กรุณา{" "}
              <Link to="/auth" className="font-medium text-primary underline">
                เข้าสู่ระบบ
              </Link>{" "}
              ก่อนรายงานสถานะ
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              aria-pressed={status === key}
              disabled={geo.phase !== "ok"}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors disabled:opacity-50",
                status === key ? "border-accent-strong bg-secondary" : "border-border",
              )}
            >
              <StatusBadge status={key} />
            </button>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={geo.phase !== "ok"}
          maxLength={200}
          placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ) เช่น เหลือประมาณ 2 กิโล"
          aria-label="หมายเหตุเพิ่มเติม"
        />

        <DialogFooter className="gap-2 sm:justify-between">
          {restaurant && (
            <Link
              to="/restaurant/$restaurantId"
              params={{ restaurantId: restaurant.id }}
              className="text-sm text-muted-foreground underline"
            >
              ดูรายละเอียดร้าน
            </Link>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submit.isPending ? "กำลังบันทึก..." : `บันทึกสถานะ ${STATUS_LABEL[status]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
