import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getScheduleOverview } from "@/lib/adminQueries";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminConsole } from "./AdminConsole";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 · 아시바당" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login?callbackUrl=%2Fadmin");
  }
  // 화면 진입 자체를 막는다. 서버 액션 쪽에도 같은 검사가 따로 있다.
  if (!session.user.isAdmin) {
    redirect("/");
  }

  const [schedule, settings] = await Promise.all([getScheduleOverview(), getSettings()]);

  return (
    <main className={styles.main}>
      <SiteHeader active="admin" kicker="ADMIN" />
      <div className={styles.body}>
        <AdminConsole current={schedule.current} queue={schedule.queue} settings={settings} />
      </div>
    </main>
  );
}
