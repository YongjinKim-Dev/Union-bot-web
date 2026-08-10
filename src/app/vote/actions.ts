"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  castVote,
  getActiveSurvey,
  getCharacterClassesByType,
  setUserCharacterClass,
} from "@/lib/queries";
import type { ClassType, VotingType } from "@/lib/types";

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
  revalidatePath("/vote");
  return result;
}

export async function fetchClassesByType(type: ClassType) {
  return getCharacterClassesByType(type);
}

export async function selectCharacterClass(characterClassId: string) {
  const user = await requireSessionUser();
  await setUserCharacterClass(user.dbUserId, characterClassId);
  revalidatePath("/vote");
}
