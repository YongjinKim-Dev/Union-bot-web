import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { getRecentSurveys } from "@/lib/queries";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import { AdminPanel } from "./AdminPanel";
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

  const surveys = await getRecentSurveys();

  return (
    <main className={styles.main}>
      <SiteHeader active="admin" kicker="ADMIN" />
      <div className={styles.body}>
        <AdminPanel
          surveys={surveys.map((s) => ({
            id: s.id,
            status: s.status,
            executedLabel: `${formatSurveyDate(s.executed_at)} ${formatSurveyTime(s.executed_at)}`,
            exposedLabel: `${formatSurveyDate(s.exposed_at)} ${formatSurveyTime(s.exposed_at)}`,
          }))}
        />
      </div>
    </main>
  );
}
