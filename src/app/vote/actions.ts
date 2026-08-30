"use server";

import { revalidatePath } from "next/cache";
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
  const user = await requireSessionUser();

  // 창이 열렸는지는 서버가 최종 판단한다. 클라이언트 카운트다운이 시계 오차로
  // 조금 일찍 0 이 되더라도 여기서 걸러진다.
  const survey = await getCurrentSurvey();
  if (!survey || survey.id !== surveyId) {
    throw new Error("이미 마감되었거나 존재하지 않는 설문입니다.");
  }
  if (!isVotingOpen(survey)) {
    throw new Error("아직 투표가 열리지 않았거나 이미 마감되었습니다.");
  }

  const result = await castVote(surveyId, user.dbUserId, votingType);

  revalidatePath("/vote");
  return result;
}
