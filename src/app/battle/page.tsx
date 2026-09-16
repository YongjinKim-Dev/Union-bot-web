import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteShell } from "@/components/SiteShell";
import { getBattleBoard } from "@/lib/battleQueries";
import { BattleHub } from "./BattleHub";
import styles from "./battle.module.css";

export const metadata = { title: "거점전/공성전 · 아시바당" };

// 관리자가 자리를 고치면 바로 보여야 한다.
export const dynamic = "force-dynamic";

export default async function BattlePage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login");
  }
  // 내려 둔 지역·거점은 관리자에게만 보인다. 기록으로 남기려고 내린 것이지
  // 길드원 목록에까지 세워 두려는 것은 아니다.
  const isAdmin = session.user.isAdmin === true;
  const regions = await getBattleBoard(isAdmin);

  return (
    <SiteShell mainClassName={styles.main} active="battle" kicker="BATTLE">
      <BattleHub regions={regions} isAdmin={isAdmin} />
    </SiteShell>
  );
}
