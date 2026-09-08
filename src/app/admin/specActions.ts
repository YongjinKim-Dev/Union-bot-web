"use server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  getLatestSpecSurvey, getOpenSpecSurvey, getSpecSubmissions,
  type SpecSubmissionListRow,
} from "@/lib/specQueries";

export interface SpecSurveyView { title: string; open: boolean }

export async function fetchSpecSubmissions(): Promise<{
  survey: SpecSurveyView | null;
  rows: SpecSubmissionListRow[];
}> {
  await requireAdmin();
  const open = await getOpenSpecSurvey();
  const survey = open ?? (await getLatestSpecSurvey());
  if (!survey) return { survey: null, rows: [] };
  return {
    survey: { title: survey.title, open: open !== null },
    rows: await getSpecSubmissions(survey.id),
  };
}
