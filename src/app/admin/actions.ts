"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createSurvey, getVoters, getNonVoters } from "@/lib/queries";
import { sendSurveyAnnouncement } from "@/lib/discord";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";

/**
 * 모든 관리자 액션은 여기를 통과한다. 화면에서 메뉴를 숨기는 것만으로는 부족하고,
 * 서버 액션은 URL 만 알면 직접 호출될 수 있으므로 매번 역할을 확인한다.
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.dbUserId) throw new Error("로그인이 필요합니다.");
  if (!session.user.isAdmin) throw new Error("권한이 없습니다.");
  return session.user;
}

export async function fetchVoters(surveyId: string) {
  await requireAdmin();
  const [voters, nonVoters] = await Promise.all([
    getVoters(surveyId),
    getNonVoters(surveyId),
  ]);
  return { voters, nonVoters };
}

export interface CreateSurveyInput {
  /** 거점전 일시 (KST, "2026-08-30T21:00" 형태의 datetime-local 값) */
  executedAt: string;
  /** 투표가 열리는 일시 (KST, 같은 형태) */
  exposedAt: string;
  announce: boolean;
}

/** KST 로 입력된 datetime-local 문자열을 실제 시각으로 바꾼다. */
function parseKst(value: string): Date {
  // datetime-local 은 타임존이 없다. 브라우저 타임존에 끌려가지 않도록
  // +09:00 을 명시해 해석한다.
  const parsed = new Date(`${value}:00+09:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("일시 형식이 올바르지 않습니다.");
  return parsed;
}

export async function registerSurvey(input: CreateSurveyInput) {
  await requireAdmin();

  const executedAt = parseKst(input.executedAt);
  const exposedAt = parseKst(input.exposedAt);

  if (exposedAt >= executedAt) {
    throw new Error("투표 시작은 거점전 시각보다 앞서야 합니다.");
  }
  const closesAt = new Date(executedAt.getTime() - 60 * 60 * 1000);
  if (exposedAt >= closesAt) {
    throw new Error("투표가 열리기도 전에 마감됩니다. 거점전 1시간 전보다 앞서 열어주세요.");
  }

  const dateLabel = `${formatSurveyDate(executedAt)} ${formatSurveyTime(executedAt)}`;
  const content = `${dateLabel} 거점전 설문조사`;

  const surveyId = await createSurvey({ content, executedAt, exposedAt });

  let announced = false;
  if (input.announce) {
    const base = process.env.NEXTAUTH_URL ?? "";
    announced = await sendSurveyAnnouncement({
      title: dateLabel,
      opensAtLabel: `${formatSurveyDate(exposedAt)} ${formatSurveyTime(exposedAt)}`,
      voteUrl: `${base.replace(/\/$/, "")}/vote`,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/vote");
  revalidatePath("/");
  return { surveyId, announced };
}
