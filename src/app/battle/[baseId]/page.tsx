import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteShell } from "@/components/SiteShell";
import { getBaseDetail, getComments } from "@/lib/battleQueries";
import { SpotBoard } from "./SpotBoard";
import { CommentBoard } from "./CommentBoard";
import styles from "../battle.module.css";

export const dynamic = "force-dynamic";

export default async function BaseDetailPage({ params }: { params: Promise<{ baseId: string }> }) {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login");
  }
  const { baseId } = await params;
  const isAdmin = session.user.isAdmin === true;

  const base = await getBaseDetail(baseId, isAdmin);
  if (!base) notFound();
  const comments = await getComments(base.id);

  return (
    <SiteShell mainClassName={styles.main} active="battle" kicker="BATTLE">
      <div className={styles.page}>
        <nav className={styles.crumbs}>
          <Link href="/battle" className={styles.crumbLink}>
            거점전
          </Link>
          <span className={styles.crumbSep}>›</span>
          <span>{base.regionName}</span>
        </nav>

        <header className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>{base.name}</h1>
            <p className={styles.lead}>
              {base.regionName} · 주요 자리 {base.spots.filter((spot) => spot.isActive).length}곳
              {!base.isActive && " · 내려 둔 거점입니다"}
            </p>
          </div>
        </header>

        <SpotBoard baseId={base.id} spots={base.spots} isAdmin={isAdmin} />

        <CommentBoard
          baseId={base.id}
          comments={comments}
          viewerId={session.user.dbUserId}
          isAdmin={isAdmin}
        />
      </div>
    </SiteShell>
  );
}
