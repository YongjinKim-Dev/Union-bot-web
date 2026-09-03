"use server";

import { auth } from "@/auth";
import { castVote, getCurrentSurvey, isVotingOpen } from "@/lib/queries";
import type { VotingType } from "@/lib/types";

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    throw new Error("로그인이 필요합니다.");
  }
  return session.user;
}

export async function submitVote(surveyId: string, votingType: VotingType) {
  // 순번의 근거가 되는 시각이므로 다른 무엇보다 먼저 찍는다. 로그인 확인이나
  // 설문 조회 뒤에 찍으면 그 DB 왕복에 걸린 시간만큼 순번이 뒤로 밀린다.
  const arrivedAt = new Date();

  const user = await requireSessionUser();

  // 창이 열렸는지는 서버가 최종 판단한다. 클라이언트 카운트다운이 시계 오차로
  // 조금 일찍 0 이 되더라도 여기서 걸러진다. 판정 기준도 도착 시각으로 맞춘다.
  const survey = await getCurrentSurvey(arrivedAt);
  if (!survey || survey.id !== surveyId) {
    throw new Error("이미 마감되었거나 존재하지 않는 설문입니다.");
  }
  if (!isVotingOpen(survey, arrivedAt)) {
    throw new Error("아직 투표가 열리지 않았거나 이미 마감되었습니다.");
  }

  const result = await castVote(surveyId, user.dbUserId, votingType, arrivedAt);

  // revalidatePath 를 부르지 않는다. 화면은 이 반환값으로 VoteButtons 가 직접
  // 갱신하고, /vote 는 force-dynamic 이라 다시 열면 어차피 새로 읽는다. 반면
  // revalidate 는 응답에 페이지 전체를 다시 그려 실어 보내므로, 표 하나당 DB
  // 왕복이 6 번 더 붙는다. 투표가 몰리는 순간에는 그 비용이 그대로 대기열이 된다.
  return result;
}
