import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  // 디자인 확정 전 단계라 콘솔은 자체 더미로 돌아간다. DB 조회는 배선 때 붙인다.
  return (
    <main className={styles.main}>
      <SiteHeader active="admin" kicker="ADMIN" />
      <div className={styles.body}>
        <AdminConsole />
      </div>
    </main>
  );
}
