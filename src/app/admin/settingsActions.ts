"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { type AutoRule, saveAutoRule } from "@/lib/settings";
import { rebuildAutoQueue } from "@/lib/surveyQueue";
import { type CreateSurveyInput, registerSurvey } from "./actions";

/* 규칙을 저장하고 그 자리에서 예정 큐를 새 규칙대로 다시 채운다. */
export async function saveAutoRuleAction(rule: AutoRule) {
  await requireAdmin();

  if (rule.announceMinutes < 0 || !/^\d{2}:\d{2}$/.test(rule.battleTime) || !/^\d{2}:\d{2}$/.test(rule.openTime)) {
    throw new Error("규칙 값이 올바르지 않습니다.");
  }

  const now = new Date();
  await saveAutoRule(rule, now);
  await rebuildAutoQueue(now);
  revalidatePath("/admin");
}

/* 수동 회차 등록. 검증과 공지 조립은 등록 액션이 다 하므로 큐 화면만 새로 고친다. */
export async function addManualSurveyAction(input: CreateSurveyInput) {
  const result = await registerSurvey(input);
  revalidatePath("/admin");
  return result;
}

/* 큐에서 빼기 */
export async function cancelSurveyAction(surveyId: string) {
  await requireAdmin();
  await pool.execute("UPDATE survey SET status = 'cancel', updated_at = ? WHERE id = ?", [
    new Date(),
    surveyId,
  ]);
  revalidatePath("/admin");
}

/* 즉시 마감. complete 가 찍히면 시각과 무관하게 투표가 닫힌다. */
export async function closeSurveyAction(surveyId: string) {
  await requireAdmin();
  await pool.execute("UPDATE survey SET status = 'complete', updated_at = ? WHERE id = ?", [
    new Date(),
    surveyId,
  ]);
  revalidatePath("/admin");
}
