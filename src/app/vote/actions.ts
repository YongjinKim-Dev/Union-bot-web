"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { type CastVoteResult, castVote, getCurrentSurvey, isVotingOpen } from "@/lib/queries";
import { logVoteFailure } from "@/lib/voteLog";
import type { VotingType } from "@/lib/types";

/*
 * 투표가 거절되는 이유는 정상 동작의 일부다 — 오래 열어둔 탭에서 지난 회차를
 * 누르거나, 마감 직전에 눌렀거나, 로그인이 풀렸거나.
 *
 * 이런 것을 throw 로 던지면 프로덕션 빌드에서는 메시지가 클라이언트까지 오지
 * 않는다. React 가 "Minified React error #441" 로 바꿔 버려서, 사용자는 왜
 * 안 됐는지 알 수 없는 영문 오류 코드를 보게 된다. 그래서 반환값으로 돌려준다.
 */
export type SubmitVoteResult =
  | { ok: true; vote: CastVoteResult }
  | { ok: false; reason: "auth" | "closed"; message: string };

export async function submitVote(
  surveyId: string,
  votingType: VotingType,
): Promise<SubmitVoteResult> {
  // 순번의 근거가 되는 시각이므로 다른 무엇보다 먼저 찍는다. 로그인 확인이나
  // 설문 조회 뒤에 찍으면 그 DB 왕복에 걸린 시간만큼 순번이 뒤로 밀린다.
  const arrivedAt = new Date();

  /*
   * 거절된 요청만 남긴다. 성공한 표는 survey_history 에 도착 시각까지 그대로
   * 남으므로 따로 적을 것이 없다.
   *
   * after 로 미뤄 응답이 나간 뒤에 쓴다. 로그 때문에 투표가 느려지면 안 되고,
   * 특히 투표가 몰리는 순간에는 DB 왕복 한 번이 그대로 대기열이 된다.
   */
  const fail = (
    reason: "auth" | "closed",
    message: string,
    ctx: { surveyId: string | null; userId: string | null; nickname: string | null },
  ): SubmitVoteResult => {
    after(async () => {
      const ua = (await headers()).get("user-agent");
      await logVoteFailure({
        ...ctx,
        votingType,
        reason,
        message,
        userAgent: ua,
        arrivedAt,
        elapsedMs: Date.now() - arrivedAt.getTime(),
      });
    });
    return { ok: false, reason, message };
  };

  const session = await auth();
  if (!session?.user?.dbUserId) {
    return fail("auth", "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요.", {
      surveyId,
      userId: null,
      nickname: null,
    });
  }
  const who = {
    surveyId,
    userId: session.user.dbUserId,
    nickname: session.user.nickname ?? null,
  };

  // 창이 열렸는지는 서버가 최종 판단한다. 클라이언트 카운트다운이 시계 오차로
  // 조금 일찍 0 이 되더라도 여기서 걸러진다. 판정 기준도 도착 시각으로 맞춘다.
  const survey = await getCurrentSurvey(arrivedAt);
  if (!survey || survey.id !== surveyId) {
    return fail(
      "closed",
      "이 회차는 이미 마감되었습니다. 새로 고침하면 현재 회차가 나옵니다.",
      who,
    );
  }
  if (!isVotingOpen(survey, arrivedAt)) {
    return fail("closed", "아직 투표가 열리지 않았거나 이미 마감되었습니다.", who);
  }

  const vote = await castVote(surveyId, session.user.dbUserId, votingType, arrivedAt);

  // revalidatePath 를 부르지 않는다. 화면은 이 반환값으로 VoteButtons 가 직접
  // 갱신하고, /vote 는 force-dynamic 이라 다시 열면 어차피 새로 읽는다. 반면
  // revalidate 는 응답에 페이지 전체를 다시 그려 실어 보내므로, 표 하나당 DB
  // 왕복이 6 번 더 붙는다. 투표가 몰리는 순간에는 그 비용이 그대로 대기열이 된다.
  return { ok: true, vote };
}
