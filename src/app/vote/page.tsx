import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
  getCurrentSurvey,
  getLatestClosedSurvey,
  getUserCharacterClass,
  getVoteCounts,
  getVoteForUser,
} from "@/lib/queries";
import { getVotingClosesAt } from "@/lib/format";
import { VoteTabs } from "./VoteTabs";
import { CurrentSurveyPanel } from "./CurrentSurveyPanel";
import { PastSurveySummary } from "./PastSurveySummary";
import styles from "./vote.module.css";

// This page always reflects the live survey/vote state, so it must never be
// statically cached or evaluated against stale DB data at build time.
export const dynamic = "force-dynamic";

export default async function VotePage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login");
  }

  // 열려 있든 아직 아니든 "이번 설문" 하나만 가져온다. 클라이언트가 서버 시각으로
  // 열리는 순간을 직접 판단하므로, 상태별로 나눠 받을 필요가 없다.
  const [currentSurvey, pastSurvey] = await Promise.all([
    getCurrentSurvey(),
    getLatestClosedSurvey(),
  ]);

  const [vote, classInfo, pastCounts] = await Promise.all([
    currentSurvey ? getVoteForUser(currentSurvey.id, session.user.dbUserId) : Promise.resolve(null),
    currentSurvey ? getUserCharacterClass(session.user.dbUserId) : Promise.resolve(null),
    pastSurvey ? getVoteCounts(pastSurvey.id) : Promise.resolve(null),
  ]);

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <Link href="/" className={styles.homeLink}>
          ← 홈
        </Link>
        <div className={styles.headerRight}>
          <span className={styles.nickname}>{session.user.nickname}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className={styles.logoutButton}>
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <div className={styles.card}>
        <VoteTabs
          currentContent={
            currentSurvey ? (
              <CurrentSurveyPanel
                surveyId={currentSurvey.id}
                opensAt={currentSurvey.exposed_at.getTime()}
                executedAt={currentSurvey.executed_at.getTime()}
                closesAt={getVotingClosesAt(currentSurvey.executed_at).getTime()}
                initialVote={vote?.votingType ?? null}
                initialVotedAt={vote?.votedAt ?? null}
                initialClassInfo={classInfo}
              />
            ) : (
              <p className={styles.notice}>예정되었거나 진행중인 설문이 없습니다.</p>
            )
          }
          pastContent={
            pastSurvey && pastCounts ? (
              <PastSurveySummary survey={pastSurvey} counts={pastCounts} />
            ) : (
              <p className={styles.notice}>지난 설문이 없습니다.</p>
            )
          }
        />
      </div>
    </main>
  );
}
