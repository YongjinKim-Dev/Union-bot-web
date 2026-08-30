import { formatSurveyDate, formatSurveyTime } from "@/lib/format";

/* 공지 문구를 따로 정하지 않은 설문에 쓰는 기본 문구. 등록 화면과 자동 등록이 같이 쓴다. */
export function buildDefaultAnnounceContent(executedAt: Date, exposedAt: Date): string {
  const executedLabel = `${formatSurveyDate(executedAt)} ${formatSurveyTime(executedAt)}`;
  const opensLabel = `${formatSurveyDate(exposedAt)} ${formatSurveyTime(exposedAt)}`;
  const voteUrl = `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/vote`;
  return (
    `📋 **${executedLabel}** 거점전 설문조사\n\n` +
    `투표는 **${opensLabel}** 에 열립니다. 모두에게 같은 시각에 열리며, ` +
    `링크를 미리 열어두면 남은 시간이 표시됩니다.\n${voteUrl}`
  );
}
