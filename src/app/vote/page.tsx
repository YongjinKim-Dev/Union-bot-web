import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
  getLatestCompletedSurvey,
  getNextWaitingSurvey,
  getOpenSurvey,
  getUserCharacterClass,
  getVoteCounts,
  getVoteForUser,
} from "@/lib/queries";
import { formatSurveyDate, formatSurveyTime, getVotingClosesAt } from "@/lib/format";
import { VoteButtons } from "./VoteButtons";
import { VoteTabs } from "./VoteTabs";
import { WaitingSurveyPanel } from "./WaitingSurveyPanel";
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

  // One targeted query per tab. Loading every survey to pick three meant
  // pulling all 776 rows (52KB of `content`) on each request.
  const [processSurvey, waitSurvey, pastSurvey] = await Promise.all([
    getOpenSurvey(),
    getNextWaitingSurvey(),
    getLatestCompletedSurvey(),
  ]);

  const [vote, classInfo, pastCounts] = await Promise.all([
    processSurvey ? getVoteForUser(processSurvey.id, session.user.dbUserId) : Promise.resolve(null),
    processSurvey ? getUserCharacterClass(session.user.dbUserId) : Promise.resolve(null),
    pastSurvey ? getVoteCounts(pastSurvey.id) : Promise.resolve(null),
  ]);

  const closed = processSurvey ? new Date() >= getVotingClosesAt(processSurvey.executed_at) : false;

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
            processSurvey ? (
              <>
                <h1 className={styles.title}>거점전 설문조사</h1>
                <p className={styles.dateLine}>
                  거점 일시 {formatSurveyDate(processSurvey.executed_at)}{" "}
                  {formatSurveyTime(processSurvey.executed_at)}
                </p>
                <p className={styles.instruction}>
                  선택지는 하나만 선택해주세요. (부속인 경우 부속만 선택)
                </p>
                <VoteButtons
                  surveyId={processSurvey.id}
                  initialVote={vote?.votingType ?? null}
                  initialVotedAt={vote?.votedAt ?? null}
                  closed={closed}
                  initialClassInfo={classInfo}
                />
              </>
            ) : waitSurvey ? (
              // 아직 열리지 않은 설문. 패널이 5초마다 서버 데이터를 다시 받아
              // 오므로, 열리는 순간 탭 이동 없이 위 투표 화면으로 바뀐다.
              <WaitingSurveyPanel survey={waitSurvey} />
            ) : (
              <p className={styles.notice}>현재 진행중이거나 대기중인 설문이 없습니다.</p>
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
