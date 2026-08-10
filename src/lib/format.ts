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

// Voting closes one hour before executed_at, same window enforced by the
// bot's close_survey background task.
export function getVotingClosesAt(executedAt: Date): Date {
  return new Date(executedAt.getTime() - 60 * 60 * 1000);
}
