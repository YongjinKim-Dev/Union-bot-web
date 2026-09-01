"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createSurvey, getVoters, getNonVoters } from "@/lib/queries";
import { getFinalRoster } from "@/lib/adminQueries";
import { buildDefaultAnnounceContent } from "@/lib/announce";
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

/*
 * 운영 화면 명단. 원본이 아니라 확정 명단을 읽는다.
 * confirmed 가 false 면 아직 마감 전이라 원본을 그대로 보여주는 중이고, 편집할 수 없다.
 */
export async function fetchRoster(surveyId: string) {
  await requireAdmin();
  const [final, nonVoters] = await Promise.all([
    getFinalRoster(surveyId),
    getNonVoters(surveyId),
  ]);
  return { voters: final.rows, nonVoters, confirmed: final.confirmed };
}

/* 되돌리기용. 사람들이 실제로 누른 표를 투표순 그대로 준다. */
export async function fetchOriginalRoster(surveyId: string) {
  await requireAdmin();
  const { getOriginalRoster } = await import("@/lib/adminQueries");
  return getOriginalRoster(surveyId);
}

export interface CreateSurveyInput {
  /** 거점전 일시 (KST, "2026-08-30T21:00" 형태의 datetime-local 값) */
  executedAt: string;
  /** 투표가 열리는 일시 (KST, 같은 형태) */
  exposedAt: string;
  /** 투표 열리기 몇 분 전에 공지할지. 0 이하면 공지하지 않는다. */
  announceMinutesBefore: number;
  /** 공지 문구. 비우면 기본 문구를 만들어 쓴다. */
  announceContent: string;
  /** 체크하면 공지 문구 맨 앞에 @everyone 멘션을 붙인다. */
  announceEveryone: boolean;
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

  const executedLabel = `${formatSurveyDate(executedAt)} ${formatSurveyTime(executedAt)}`;
  const content = `${executedLabel} 거점전 설문조사`;

  // "N분 전"을 절대 시각으로 환산해 저장한다. 조회가 단순해지고, 나중에 분을
  // 바꿔도 이미 등록된 설문의 공지 시각이 흔들리지 않는다.
  const minutes = Number(input.announceMinutesBefore);
  const wantsAnnounce = Number.isFinite(minutes) && minutes > 0;
  const announceAt = wantsAnnounce
    ? new Date(exposedAt.getTime() - minutes * 60 * 1000)
    : null;

  const baseAnnounce = input.announceContent.trim() || buildDefaultAnnounceContent(executedAt, exposedAt);
  const announceContent = wantsAnnounce
    ? input.announceEveryone
      ? `@everyone\n${baseAnnounce}`
      : baseAnnounce
    : null;

  const surveyId = await createSurvey({ content, executedAt, exposedAt, announceAt, announceContent });

  revalidatePath("/admin");
  revalidatePath("/vote");
  revalidatePath("/");
  return {
    surveyId,
    announceAt: announceAt ? `${formatSurveyDate(announceAt)} ${formatSurveyTime(announceAt)}` : null,
  };
}
