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
