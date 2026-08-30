"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { type CreateSurveyInput, registerSurvey } from "./actions";

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
