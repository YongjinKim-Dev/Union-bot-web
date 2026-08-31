import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
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
      <SiteHeader active="vote" kicker="VOTE" />

      <div className={styles.content}>
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
                  announceAt={
                    currentSurvey.announce_at && currentSurvey.discord_message_id === null
                      ? currentSurvey.announce_at.getTime()
                      : null
                  }
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
      </div>
    </main>
  );
}
