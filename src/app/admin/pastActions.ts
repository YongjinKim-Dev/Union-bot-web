"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { type PastSurveyRow, getPastSurveys } from "@/lib/adminQueries";

const PAGE_SIZE = 15;

export async function fetchPastSurveys(
  page: number,
): Promise<{ rows: PastSurveyRow[]; total: number; pageSize: number }> {
  await requireAdmin();
  const { rows, total } = await getPastSurveys(page, PAGE_SIZE);
  return { rows, total, pageSize: PAGE_SIZE };
}

/* 회차 하나의 원본 ↔ 확정 명단 비교 */
export async function fetchRosterComparison(surveyId: string) {
  await requireAdmin();
  const { getRosterComparison } = await import("@/lib/adminQueries");
  return getRosterComparison(surveyId);
}

/* 비교 탭 회차 목록. 운영 중인 회차도 포함한다. */
export async function fetchComparableSurveys(page: number) {
  await requireAdmin();
  const { getComparableSurveys } = await import("@/lib/adminQueries");
  const { rows, total } = await getComparableSurveys(page, PAGE_SIZE);
  return { rows, total, pageSize: PAGE_SIZE };
}
