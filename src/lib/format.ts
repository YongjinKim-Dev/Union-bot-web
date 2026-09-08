const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

// Matches the bot's parse_str_to_date output, e.g. "2026-08-10 (월)".
export function formatSurveyDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  const weekdayIndex = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  ).getDay();

  return `${y}-${m}-${d} (${WEEKDAYS_KO[weekdayIndex]})`;
}

export function formatSurveyTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** "22:30:07" — 투표 로그는 순번이 중요해서 초까지 보여준다. */
export function formatKstTimeWithSeconds(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * "22:30:00.078" — 순번을 가르는 것은 밀리초다.
 *
 * 투표가 열리는 순간에는 같은 초에 수십 명이 몰린다. 초까지만 보면 그 안에서
 * 누가 먼저인지 알 수 없어 순번의 근거를 확인할 수 없다. 도착 시각은 밀리초까지
 * 기록되므로 그대로 보여 준다.
 */
export function formatKstTimeWithMillis(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(date);
}

// Voting closes one hour before executed_at, same window enforced by the
// bot's close_survey background task.
/** "09.08 16:40" — 제출 시각처럼 날짜와 분까지만 보이면 되는 자리. */
export function formatKstDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const at = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${at("month")}.${at("day")} ${at("hour")}:${at("minute")}`;
}

export function getVotingClosesAt(executedAt: Date): Date {
  return new Date(executedAt.getTime() - 60 * 60 * 1000);
}
