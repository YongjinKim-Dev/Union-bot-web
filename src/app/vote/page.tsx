import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getActiveSurvey, getUserCharacterClass, getVoteForUser } from "@/lib/queries";
import { formatSurveyDate, formatSurveyTime, getVotingClosesAt } from "@/lib/format";
import { VoteButtons } from "./VoteButtons";
import styles from "./vote.module.css";

// This page always reflects the live survey/vote state, so it must never be
// statically cached or evaluated against stale DB data at build time.
export const dynamic = "force-dynamic";

export default async function VotePage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login");
  }

  const survey = await getActiveSurvey();
  const [vote, classInfo] = survey
    ? await Promise.all([
        getVoteForUser(survey.id, session.user.dbUserId),
        getUserCharacterClass(session.user.dbUserId),
      ])
    : [null, null];

  const closed = survey ? new Date() >= getVotingClosesAt(survey.executed_at) : false;

  return (
    <main className={styles.main}>
      <div className={styles.header}>
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

      <div className={styles.card}>
        {!survey ? (
          <p className={styles.notice}>현재 진행중인 설문이 없습니다.</p>
        ) : (
          <>
            <h1 className={styles.title}>거점전 설문조사</h1>
            <p className={styles.dateLine}>
              거점 일시 {formatSurveyDate(survey.executed_at)} {formatSurveyTime(survey.executed_at)}
            </p>
            <p className={styles.instruction}>선택지는 하나만 선택해주세요. (부속인 경우 부속만 선택)</p>
            <VoteButtons
              surveyId={survey.id}
              initialVote={vote?.votingType ?? null}
              initialVotedAt={vote?.votedAt ?? null}
              closed={closed}
              initialClassInfo={classInfo}
            />
          </>
        )}
      </div>
    </main>
  );
}
