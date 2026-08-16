import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-mookrob";
import { cn } from "@/lib/utils";

const TITLE = "เข้าสู่ระบบ MooKrob Tracker";
const DESCRIPTION =
  "เข้าสู่ระบบเพื่อรายงานสถานะหมูกรอบ บันทึกร้านโปรด และสะสมคะแนนความน่าเชื่อถือ";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/profile" });
  }, [session, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("เข้าสู่ระบบสำเร็จ");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("สมัครสมาชิกสำเร็จ", { description: "เริ่มรายงานหมูกรอบได้เลย" });
      }
    } catch (error) {
      toast.error("ไม่สำเร็จ", {
        description: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/profile" });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          เข้าสู่ระบบเพื่อรายงานสถานะหมูกรอบ บันทึกร้านโปรด และสะสมคะแนนความน่าเชื่อถือ
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
          {(["signin", "signup"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                mode === key ? "bg-accent-strong text-accent-strong-foreground" : "text-muted-foreground",
              )}
            >
              {key === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <label className="block">
              <span className="text-sm font-medium">ชื่อที่แสดง</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น สมชาย หมูกรอบ"
                className="mt-1.5 h-11"
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium">อีเมล</span>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-11"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">รหัสผ่าน</span>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              className="mt-1.5 h-11"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-strong-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "กำลังดำเนินการ..." : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          หรือ
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </AppShell>
  );
}
