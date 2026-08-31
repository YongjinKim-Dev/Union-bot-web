import { getVotingClosesAt } from "@/lib/format";
import type { DbSurvey } from "@/lib/types";

/** Node wars run Mon–Fri and Sun. Saturday is deliberately absent. */
export const NODE_WAR_WEEKDAYS = [1, 2, 3, 4, 5, 0] as const;

const WEEKDAY_LABEL: Record<number, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

const WEEKDAY_LONG_LABEL: Record<number, string> = {
  0: "일요일",
  1: "월요일",
  2: "화요일",
  3: "수요일",
  4: "목요일",
  5: "금요일",
  6: "토요일",
};

export type DayState = "마감" | "진행" | "예정" | "미등록";

export interface DaySlot {
  /** 0=Sun … 6=Sat, in KST. */
  weekday: number;
  label: string;
  longLabel: string;
  /** "08.27" */
  date: string;
  isToday: boolean;
  survey: DbSurvey | null;
  state: DayState;
}

/**
 * Calendar fields for an instant as observed in Asia/Seoul. Doing this through
 * Intl rather than manual UTC+9 math keeps it correct regardless of the
 * server's own timezone.
 */
function kstParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayShort = get("weekday");
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayShort);

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday,
  };
}

export function getKstWeekday(date: Date): number {
  return kstParts(date).weekday;
}

/** "08.27" — the compact form used on the day cards. */
export function formatDayDate(date: Date): string {
  const { month, day } = kstParts(date);
  return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

/** "26.08.27" — the hero headline date. */
export function formatShortDate(date: Date): string {
  const { year, month, day } = kstParts(date);
  return [
    String(year).slice(2),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join(".");
}

export function getWeekdayLabel(weekday: number): string {
  return WEEKDAY_LABEL[weekday] ?? "";
}

export function getWeekdayLongLabel(weekday: number): string {
  return WEEKDAY_LONG_LABEL[weekday] ?? "";
}

/** True when both instants land on the same calendar day in KST. */
export function isSameKstDay(a: Date, b: Date): boolean {
  const pa = kstParts(a);
  const pb = kstParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/**
 * Monday 00:00 KST of the week containing `now`, and the exclusive end bound
 * (next Monday 00:00 KST). KST has no DST, so a fixed +09:00 offset is exact.
 */
export function getKstWeekRange(now: Date): { from: Date; to: Date } {
  const { year, month, day, weekday } = kstParts(now);
  // Sunday (0) belongs to the week that started six days earlier.
  const daysSinceMonday = (weekday + 6) % 7;

  const mondayUtcMs = Date.UTC(year, month - 1, day) - daysSinceMonday * 86_400_000;
  // Date.UTC gave us KST-midnight expressed as if it were UTC; shift back 9h
  // to get the real instant.
  const from = new Date(mondayUtcMs - 9 * 3_600_000);
  const to = new Date(from.getTime() + 7 * 86_400_000);
  return { from, to };
}

/*
 * 요일 칸 상태는 시각으로 정한다. status 로 판단하면 안 된다 — 예전에는 봇이
 * 1분 루프로 process/complete 를 찍어줬지만 그 루프를 껐고, 웹 등록은 처음부터
 * process 로 들어간다. 그대로 두면 다음 주 회차까지 "진행"으로 보인다.
 *
 * 투표 창은 /vote 와 같은 기준을 쓴다: exposed_at <= now < executed_at - 1시간.
 */
function resolveState(survey: DbSurvey | null, now: Date): DayState {
  if (!survey) return "미등록";
  // 관리자가 즉시 마감을 누른 회차만 시각과 무관하게 닫힌다.
  if (survey.status === "complete") return "마감";
  if (now.getTime() >= getVotingClosesAt(survey.executed_at).getTime()) return "마감";
  if (now.getTime() >= survey.exposed_at.getTime()) return "진행";
  return "예정";
}

/**
 * Six ordered day slots (월–금 then 일) for the week containing `now`, each
 * paired with that day's survey when one exists. `cancel` surveys are filtered
 * out by the caller's query, so a day with only a cancelled survey reads as
 * 미등록.
 */
export function buildWeekSlots(now: Date, surveys: DbSurvey[]): DaySlot[] {
  const { from } = getKstWeekRange(now);

  return NODE_WAR_WEEKDAYS.map((weekday) => {
    // Sunday closes the week, so it sits 6 days after Monday rather than 0.
    const offset = weekday === 0 ? 6 : weekday - 1;
    const dayDate = new Date(from.getTime() + offset * 86_400_000 + 12 * 3_600_000);

    const survey =
      surveys.find((s) => getKstWeekday(s.executed_at) === weekday) ?? null;

    return {
      weekday,
      label: getWeekdayLabel(weekday),
      longLabel: getWeekdayLongLabel(weekday),
      date: formatDayDate(survey?.executed_at ?? dayDate),
      isToday: getKstWeekday(now) === weekday,
      survey,
      state: resolveState(survey, now),
    };
  });
}
