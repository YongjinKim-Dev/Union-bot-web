/* 관리자 콘솔의 타입과 순수 계산 */

import { formatKstTimeWithSeconds } from "@/lib/format";
import type { VoterRow } from "@/lib/queries";
import { CLASS_TYPE_LABEL, VOTING_TYPE_LABEL } from "@/lib/types";
import { formatDayDate } from "@/lib/week";

export type Vote = "참여" | "부속" | "늦참" | "미참";
export type TabKey = "운영" | "지난 투표";
export type Dow = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export interface Member {
  id: string;
  nick: string;
  guild: string;
  job: string;
  line: string;
  vote: Vote;
  ord: number;
  origSeq: number;
  time: string;
}

export interface SurveyDef {
  key: string;
  iso: string;
  dow: Dow;
  battle: string;
  open: string;
  counts: Record<Vote, number>;
}

export interface ManualRound {
  id: string;
  iso: string;
  battle: string;
  openIso: string;
  open: string;
  announceMin: number;
}

export interface QueueRow {
  key: string;
  iso: string;
  dow: Dow;
  battle: string;
  openIso: string;
  openDow: Dow;
  open: string;
  announceMin: number;
  src: "자동" | "수동";
}

/* 정원 프리셋 상태는 탭을 오가도 유지되도록 콘솔이 들고, 탭에는 이 묶음으로 내려준다. */
export interface PresetControls {
  cap: number;
  setCap: (n: number) => void;
  presets: number[];
  add: (raw: string) => void;
  remove: (index: number) => void;
}

export const VOTES: Vote[] = ["참여", "부속", "늦참", "미참"];
export const DAYS: Dow[] = ["월", "화", "수", "목", "금", "토", "일"];

export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function isoOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIso(iso: string) {
  const p = iso.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

export function dowOf(d: Date): Dow {
  // getDay()는 일요일이 0이라 월요일 시작인 DAYS에 맞춰 옮긴다
  return DAYS[(d.getDay() + 6) % 7];
}

// 투표 마감은 거점전 1시간 전
export function closeOf(battle: string) {
  const [h, m] = battle.split(":").map(Number);
  return `${pad2((h + 23) % 24)}:${pad2(m)}`;
}

export function countsOf(list: Member[]): Record<Vote, number> {
  const c: Record<Vote, number> = { 참여: 0, 부속: 0, 늦참: 0, 미참: 0 };
  list.forEach((m) => {
    c[m.vote] += 1;
  });
  return c;
}

/* 순번 명단은 참여와 부속만 선다. 늦참과 미참은 순번이 없다. */
export function rosterOf(list: Member[]) {
  return list.filter((m) => m.vote === "참여" || m.vote === "부속").sort((a, b) => a.ord - b.ord);
}

export function ofVote(list: Member[], kind: Vote) {
  return list.filter((m) => m.vote === kind).sort((a, b) => a.ord - b.ord);
}

export function buildQueue(
  recurDays: Record<Dow, boolean>,
  battle: string,
  open: string,
  announceMin: number,
  manual: ManualRound[],
  from: Date,
  days: number,
): QueueRow[] {
  const rows: QueueRow[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from.getTime());
    d.setDate(d.getDate() + i);
    const dow = dowOf(d);
    if (!recurDays[dow]) continue;
    const iso = isoOf(d);
    // 자동 회차의 투표 오픈은 거점전 전날
    const prev = new Date(d.getTime());
    prev.setDate(prev.getDate() - 1);
    rows.push({
      key: `a:${iso}`,
      iso,
      dow,
      battle,
      openIso: isoOf(prev),
      openDow: dowOf(prev),
      open,
      announceMin,
      src: "자동",
    });
  }
  manual.forEach((m) => {
    rows.push({
      key: `m:${m.id}`,
      iso: m.iso,
      dow: dowOf(parseIso(m.iso)),
      battle: m.battle,
      openIso: m.openIso,
      openDow: dowOf(parseIso(m.openIso)),
      open: m.open,
      announceMin: m.announceMin,
      src: "수동",
    });
  });
  rows.sort((a, b) => (a.iso === b.iso ? a.battle.localeCompare(b.battle) : a.iso.localeCompare(b.iso)));
  return rows;
}

/* 디코로 나가는 발송본에는 예비 명단을 공개하지 않는다. 예비까지 붙는 건 관리자용 복사뿐. */
export function buildExportText(members: Member[], cap: number, heading: string, withReserve = true) {
  const roster = rosterOf(members);
  const main = roster.slice(0, cap);
  const rest = roster.slice(cap);
  // 조정 표시는 컷 밖에서 안으로 끌어올린 사람에게만 붙인다
  const mark = (m: Member, pulledIn: boolean) =>
    `${m.nick} (${m.job})${m.vote === "부속" ? " 부속" : ""}${pulledIn ? " <<<<<<<<<" : ""}`;

  const lines: string[] = [];
  lines.push(`== ${heading} 거점전 투표 결과 ==`);
  lines.push("");
  lines.push(`[참여 ${main.length}명]`);
  main.forEach((m, i) => lines.push(`${i + 1}. ${mark(m, m.origSeq > cap)}`));
  if (withReserve && rest.length > 0) {
    lines.push("");
    lines.push(`[예비 ${rest.length}명]`);
    rest.forEach((m, i) => lines.push(`${cap + i + 1}. ${mark(m, false)}`));
  }
  return lines.join("\n");
}

/* 표 목록을 화면 명단으로 바꾼다. 순번은 참여와 부속끼리만 매긴다. */
export function votersToMembers(voters: VoterRow[]): Member[] {
  // 원래 순번은 처음 투표한 순서로 매긴다. 조정 저장이 자리를 바꿔도 이 값은
  // 변하지 않아야 컷 밖에서 끌어올린 표시가 저장 뒤에도 살아 있다.
  const firstSeq = new Map<string, number>();
  voters
    .filter((v) => {
      const vote = VOTING_TYPE_LABEL[v.votingType] as Vote;
      return vote === "참여" || vote === "부속";
    })
    .sort(
      (a, b) =>
        new Date(a.firstVotedAt).getTime() - new Date(b.firstVotedAt).getTime() ||
        Number(a.historyId) - Number(b.historyId),
    )
    .forEach((v, i) => firstSeq.set(v.historyId, i + 1));

  let rosterSeq = 0;
  let restSeq = 0;
  return voters.map((v) => {
    const vote = VOTING_TYPE_LABEL[v.votingType] as Vote;
    const inRoster = vote === "참여" || vote === "부속";
    const ord = inRoster ? rosterSeq : restSeq;
    if (inRoster) rosterSeq += 1;
    else restSeq += 1;
    const votedAt = new Date(v.votedAt);
    return {
      id: v.historyId,
      nick: v.nickname,
      guild: v.guildName,
      job: v.className ?? "-",
      line: v.classType ? CLASS_TYPE_LABEL[v.classType] : "-",
      vote,
      ord,
      origSeq: inRoster ? firstSeq.get(v.historyId)! : ord + 1,
      time: `${formatDayDate(votedAt)} ${formatKstTimeWithSeconds(votedAt)}`,
    };
  });
}
