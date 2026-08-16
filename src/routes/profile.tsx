import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronRight, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TrustScoreCard } from "@/components/TrustScoreCard";
import { ReportTimeline } from "@/components/ReportTimeline";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useMyReports, useProfile, useWatchlist } from "@/hooks/use-mookrob";

const TITLE = "โปรไฟล์และคะแนนความน่าเชื่อถือ — MooKrob Tracker";
const DESCRIPTION =
  "ดูคะแนนความน่าเชื่อถือ จำนวนรายงาน ความแม่นยำ และเหรียญตราของคุณใน MooKrob Tracker";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { profile, session, sessionLoading } = useProfile();
  const { data: reports } = useMyReports();
  const { data: watchlist } = useWatchlist();

  if (!sessionLoading && !session) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border p-10 text-center">
          <h1 className="font-display text-2xl tracking-tight">ยังไม่ได้เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            เข้าสู่ระบบเพื่อดูคะแนนความน่าเชื่อถือและประวัติการรายงานของคุณ
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center rounded-full bg-accent-strong px-6 py-3 text-sm font-semibold text-accent-strong-foreground"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </AppShell>
    );
  }

  const username = profile?.username ?? "กำลังโหลด...";
  const totalReports = profile?.total_reports ?? 0;
  const accurateReports = profile?.accurate_reports ?? 0;
  const stats = {
    trustScore: profile?.trust_score ?? 0,
    totalReports,
    accurateReports,
  };
  const joined = profile
    ? new Date(profile.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long" })
    : "";

  const settings = [
    {
      icon: Bell,
      label: "การแจ้งเตือนสถานะร้านโปรด",
      value: `เปิด ${watchlist?.filter((row) => row.notifications_enabled).length ?? 0} / ${watchlist?.length ?? 0} ร้าน`,
      to: "/watchlist" as const,
    },
    { icon: Settings, label: "รัศมีการค้นหา", value: "15 กิโลเมตร" },
  ];

  return (
    <AppShell>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="size-16 shrink-0">
          <AvatarFallback className="bg-accent text-lg font-medium text-accent-foreground">
            {username.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl tracking-tight">{username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session?.user.email}
            {joined ? ` · เข้าร่วม ${joined}` : ""}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TrustScoreCard stats={stats} loading={!profile} />

        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl tracking-tight">รายงานของฉันล่าสุด</h2>
            <div className="mt-4">
              <ReportTimeline reports={reports ?? []} />
            </div>
          </section>

          <section className="rounded-3xl border border-border p-2">
            <ul>
              {settings.map((item) => {
                const inner = (
                  <>
                    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-sm">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {item.value}
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </>
                );
                const rowClass =
                  "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-secondary";
                return (
                  <li key={item.label}>
                    {"to" in item && item.to ? (
                      <Link to={item.to} className={rowClass}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={rowClass}>{inner}</div>
                    )}
                  </li>
                );
              })}

              <li>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    toast.success("ออกจากระบบแล้ว");
                    void navigate({ to: "/" });
                  }}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-secondary"
                >
                  <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-sm">ออกจากระบบ</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            </ul>
          </section>

          <Link to="/watchlist" className="block rounded-3xl bg-primary p-6 text-primary-foreground">
            <p className="font-display text-2xl tracking-tight">ดูร้านโปรดของฉัน</p>
            <p className="mt-1.5 text-sm opacity-80">
              เช็กสถานะหมูกรอบของร้านที่คุณติดตามทั้งหมด
            </p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
