import { formatSurveyDate, formatSurveyTime } from "@/lib/format";

/*
 * 공지에 함께 붙는 유의사항.
 *
 * 모르면 손해를 보는 것만 적는다. 순번이 어떻게 정해지는지, 무엇을 눌렀을 때
 * 순번이 유지되고 무엇을 눌렀을 때 뒤로 밀리는지가 그것이다. 길어지면 아무도
 * 읽지 않으므로 세 줄을 넘기지 않는다.
 */
const VOTE_NOTES = [
  "· 순번은 서버에 도착한 순서로 정해집니다. 새로 고침을 눌러도 순번은 밀리지 않습니다.",
  "· 참여 ↔ 부속 은 서로 바꿔도 순번이 그대로입니다.",
  "· 미참·늦참 을 눌렀다가 참여로 되돌리면 순번이 맨 뒤로 갑니다.",
];

/* 공지 문구를 따로 정하지 않은 설문에 쓰는 기본 문구. 등록 화면과 자동 등록이 같이 쓴다. */
export function buildDefaultAnnounceContent(executedAt: Date, exposedAt: Date): string {
  const executedLabel = `${formatSurveyDate(executedAt)} ${formatSurveyTime(executedAt)}`;
  const opensLabel = `${formatSurveyDate(exposedAt)} ${formatSurveyTime(exposedAt)}`;
  const voteUrl = `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/vote`;
  return (
    `📋 **${executedLabel}** 거점전 설문조사\n\n` +
    `투표는 **${opensLabel}** 에 열립니다. 모두에게 같은 시각에 열리며, ` +
    `링크를 미리 열어두면 남은 시간이 표시됩니다.\n${voteUrl}\n\n` +
    `📌 **유의사항**\n${VOTE_NOTES.join("\n")}`
  );
}
