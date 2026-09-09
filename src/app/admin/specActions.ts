"use server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  getGuildNames, getLatestSpecSurvey, getOpenSpecSurvey, getSpecSubmissions,
  type SpecSubmissionListRow,
} from "@/lib/specQueries";

export interface SpecSurveyView { title: string; open: boolean }

export async function fetchSpecSubmissions(): Promise<{
  survey: SpecSurveyView | null;
  guilds: string[];
  rows: SpecSubmissionListRow[];
}> {
  await requireAdmin();
  const [open, guilds] = await Promise.all([getOpenSpecSurvey(), getGuildNames()]);
  const survey = open ?? (await getLatestSpecSurvey());
  if (!survey) return { survey: null, guilds, rows: [] };
  return {
    survey: { title: survey.title, open: open !== null },
    guilds,
    rows: await getSpecSubmissions(survey.id),
  };
}
