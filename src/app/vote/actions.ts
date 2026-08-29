"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { castVote, getActiveSurvey } from "@/lib/queries";
import { sendVoteLog } from "@/lib/discord";
import { VOTING_TYPE_LABEL, type VotingType } from "@/lib/types";

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    throw new Error("로그인이 필요합니다.");
  }
  return session.user;
}

export async function submitVote(surveyId: string, votingType: VotingType) {
  const user = await requireSessionUser();

  const survey = await getActiveSurvey();
  if (!survey || survey.id !== surveyId) {
    throw new Error("이미 마감되었거나 존재하지 않는 설문입니다.");
  }

  const result = await castVote(surveyId, user.dbUserId, votingType);

  if (!result.isDuplicated) {
    void sendVoteLog(user.nickname, VOTING_TYPE_LABEL[result.votingType]);
  }

  revalidatePath("/vote");
  return result;
}
