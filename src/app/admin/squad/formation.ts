import { DEFAULT_CLASS_ICON, getClassIconPath } from "@/lib/classIconMap";
import { getClassMark } from "@/lib/classMarkMap";
import type { ClassType } from "@/lib/types";
import { hasRoleIcon } from "./roleIcons";

export interface SquadMember {
  id: string;
  name: string;
  job: string;
  awakening: string;
}

export interface Formation {
  parties: (SquadMember | null)[][];
  waiting: SquadMember[];
  rows: number;
}

export interface CellAddress { party: number; index: number }

/*
 * 칸에 붙는 직업 아이콘과 계열 마크.
 *
 * 명단에는 직업이 글자로만 들어오므로 그림은 여기서 찾는다. 직업 이름이 우리가
 * 아는 32 개에 없으면 아무것도 붙이지 않는다 — 엉뚱한 그림을 붙이느니 글자만
 * 두는 편이 낫다.
 */
export interface MemberArt {
  icon: string;
  mark: { src: string; color: string } | null;
}

const MARK_COLOR = { 전승: "#5b7fb5", 각성: "#b0555f", 기타: "#8d867c" };

export function memberArt(member: SquadMember | null | undefined): MemberArt | null {
  if (!member?.job) return null;
  const icon = getClassIconPath(member.job);
  if (icon === DEFAULT_CLASS_ICON) return null;
  const type: ClassType =
    member.awakening === "전승" ? "Succession" : member.awakening === "각성" ? "Awaken" : "Else";
  const mark = getClassMark(member.job, type);
  return {
    icon,
    mark: mark ? { src: mark.src, color: MARK_COLOR[member.awakening as keyof typeof MARK_COLOR] ?? MARK_COLOR.기타 } : null,
  };
}

/*
 * 부대표의 생김새.
 *
 * 어두운 판으로 둔 이유가 둘이다. 하나, 이 그림은 디스코드에 붙인다 — 거기가
 * 어두우므로 밝은 표는 혼자 튄다. 둘, 직업 아이콘이 흰 선화라 어두운 바탕에서는
 * 원본 그대로 얹힌다. 밝은 바탕이면 색을 뒤집는 처리가 한 겹 더 붙는다.
 */
export const SHEET = {
  names: ["1부대(본대)", "2부대(본대)", "3부대(수비)", "4부대(본대/기둥)"],
  columnWidth: 178,
  iconSize: 20,
  markSize: 12,
  roleSize: 20,
  // 직업 아이콘·계열 배지·역할 그림이 한 줄에 들어가야 한다.
  rowHeight: 32,
  headerHeight: 44,
  font: '"Malgun Gothic", Arial, sans-serif',
  panel: "#17130e",
  stripe: "#1d1811",
  grid: "#2b2318",
  border: "#6b5327",
  headerTop: "#3a2d18",
  headerBottom: "#241c11",
  headerText: "#e6c884",
  text: "#ded5c4",
  fontSize: 13,
};

export function emptyFormation(): Formation {
  return { parties: [[], [], [], []], waiting: [], rows: 10 };
}

/*
 * 이름 뒤에 붙이는 역할. 직업이 아니라 그 사람이 맡은 일이라 아이콘으로는
 * 드러나지 않는다. 손으로 글자를 치는 대신 눌러서 붙인다.
 *
 * 여기에 적힌 것만 붙일 수 있다. 늘리려면 이 줄에 더하면 된다.
 */
export const ROLES = ["오더", "빌더", "대포", "대포컷", "코끼리", "불퇴", "신기전", "화염탑", "수비", "중범선"];

/*
 * 역할을 글자 대신 그림으로 보여 준다. 칸이 좁아 "(대포컷)" 네 글자가 이름을
 * 밀어내기 때문이다. 그림은 roleIcons.ts 에 직접 그려 두었다 — 이모지에는
 * 대포도 화차도 돛단배도 없다.
 */

/** 이름 뒤에 붙어 있는 역할. 그림이 있는 것만 역할로 본다. */
export function memberRole(member: SquadMember | null | undefined): string | null {
  if (!member) return null;
  const tag = member.name.match(TRAILING_TAG)?.[1];
  return hasRoleIcon(tag) ? (tag as string) : null;
}

/** 역할만 갈아 끼운다. 같은 역할을 다시 누르면 뗀다. */
export function setRole(formation: Formation, id: string, role: string | null): Formation {
  const swap = (member: SquadMember) => {
    const bare = baseName(member.name);
    const current = member.name.match(TRAILING_TAG)?.[1];
    return { ...member, name: role && role !== current ? `${bare}(${role})` : bare };
  };
  return {
    ...formation,
    parties: formation.parties.map((party) =>
      party.map((member) => (member?.id === id ? swap(member) : member))),
    waiting: formation.waiting.map((member) => (member.id === id ? swap(member) : member)),
  };
}

export function memberLabel(member: SquadMember | null | undefined): string {
  if (!member) return "";
  // 직업도 역할도 그림으로 붙으므로 글자로 또 적지 않는다. 칸은 이름 몫이다.
  return memberRole(member) ? baseName(member.name) : member.name;
}

export function parseMembers(input: string): SquadMember[] {
  let accepting = true;
  return input.split(/\r?\n/).flatMap((line, index) => {
    line = line.trim();
    if (!line || /^==|^```/.test(line)) return [];
    if (/^\[.*\]$/.test(line)) {
      accepting = !/불참|미참|미투표|취소/.test(line);
      return [];
    }
    if (!accepting) return [];
    const parts = line.replace(/<{3,}/g, "").split("/");
    if (parts.length < 2) return [];
    const name = parts[0].replace(/^\d+\s*[.)、:\-]\s*/, "").trim();
    const awakening = parts[1].match(/\((각성|전승|기타)\)/)?.[1] ?? "";
    const job = parts[1].replace(/\((각성|전승|기타)\)/, "").trim();
    return name ? [{ id: `input-${index}`, name, job, awakening }] : [];
  });
}

/** 이름 뒤에 붙은 역할 표시. "예니체리(대포)" 의 "(대포)" 부분이다. */
const TRAILING_TAG = /\(([^()]*)\)\s*$/;

/** 역할 표시를 뗀 이름. 명단에 "홍줭(흑정)" 으로 적혀 와도 "홍줭" 으로 찾는다. */
export function baseName(name: string): string {
  return name.replace(TRAILING_TAG, "").trim();
}

/*
 * 부대 정원.
 *
 * 55 석짜리와 75 석짜리 두 벌뿐이라 그 사이가 비어 있었다. 60 명이 나오면 55
 * 석에 넣느라 다섯 명이, 69 명이면 열네 명이 말없이 미배치로 빠졌다. 그 구간이
 * 요즘 나오는 인원대와 그대로 겹친다. 이제 다 들어가는 쪽을 고른다.
 *
 * 100 인은 네 부대로 고르게 나눈다. 55·75 처럼 수비를 덜어 둔 모양이 따로 있으면
 * 여기 숫자만 바꾸면 된다.
 */
function partySizes(count: number): number[] {
  if (count > 75) return [25, 25, 25, 25];
  if (count > 55) return [20, 20, 15, 20];
  if (count >= 50) return [15, 15, 14, 11];
  return Array.from({ length: 4 }, (_, i) => Math.floor(count / 4) + (i < count % 4 ? 1 : 0));
}

// 첨부한 Google Apps Script의 고정 배치 → 직업 순환 배치 → 순차 배치 순서를 유지한다.
export function autoAssign(members: SquadMember[]): Formation {
  const sizes = partySizes(members.length);
  const parties: SquadMember[][] = [[], [], [], []];
  const assigned = new Set<string>();
  function place(member: SquadMember, party: number, suffix = "") {
    // 이미 역할이 적혀 온 이름에 또 붙이면 "예니체리(대포)(대포)" 가 된다.
    const name = suffix ? baseName(member.name) + suffix : member.name;
    parties[party].push({ ...member, name });
    assigned.add(member.id);
  }
  function fixed(name: string, party: number, suffix = "") {
    // 명단에 역할이 붙어 오거나 영문 대소문자가 달라도 같은 사람으로 본다.
    const key = name.toLowerCase();
    const member = members.find((m) => baseName(m.name).toLowerCase() === key && !assigned.has(m.id));
    if (!member) return false;
    place(member, party, suffix);
    return true;
  }

  fixed("예니체리", 0);
  fixed("홍줭", 1);
  fixed("사색가", 2, "(빌더)");
  fixed("Wheel", 3);
  fixed("마창", 0);
  let cannonCount = 0;
  for (const name of ["연필", "Nicode", "폭풍"]) {
    if (cannonCount < 2) {
      if (fixed(name, 2, "(대포)")) cannonCount++;
    } else fixed(name, 2);
  }
  for (const name of ["이랑", "RoyalJelly", "성별"]) fixed(name, 2, "(불퇴)");
  fixed("환호", 2, "(신기전)");
  for (const name of ["bingegrab", "멜루", "연등"]) fixed(name, 2, "(화염탑)");
  for (const name of ["이지선다", "Sha", "염궁문"]) fixed(name, 2, "(수비)");

  for (const job of ["샤이", "위치", "위자드", "자이언트"]) {
    let party = 0;
    for (const member of members) {
      if (member.job !== job || assigned.has(member.id)) continue;
      // 예전에는 (샤이)(자이언트)를 이름 뒤에 붙였다. 이제 아이콘이 직업을
      // 보여주므로 같은 말을 두 번 하지 않는다.
      place(member, party);
      party = (party + 1) % 4;
    }
  }

  let party = 0;
  for (const member of members) {
    if (assigned.has(member.id)) continue;
    // 원본은 범위 검사보다 배열 접근이 먼저여서 정원 초과 시 예외가 발생한다.
    while (party < 4 && parties[party].length >= sizes[party]) party++;
    if (party < 4) place(member, party);
  }
  return {
    parties,
    waiting: members.filter((member) => !assigned.has(member.id)),
    rows: Math.max(1, Math.ceil(Math.max(...sizes, ...parties.map((p) => p.length)) / 2)),
  };
}

export function sheetRows(formation: Formation) {
  return Math.max(formation.rows, ...formation.parties.map((party) =>
    Math.ceil((party.findLastIndex((member) => member !== null) + 1) / 2)));
}

// 빈칸으로는 이동하고, 이미 사람이 있는 칸으로는 자리를 맞바꾼다.
export function moveMember(formation: Formation, id: string, target: CellAddress | null): Formation {
  const parties = formation.parties.map((party) => [...party]);
  const waiting = [...formation.waiting];
  const sourceParty = parties.findIndex((party) => party.some((m) => m?.id === id));
  const sourceIndex = sourceParty < 0 ? waiting.findIndex((m) => m.id === id)
    : parties[sourceParty].findIndex((m) => m?.id === id);
  if (sourceIndex < 0) return formation;
  const member = sourceParty < 0 ? waiting[sourceIndex] : parties[sourceParty][sourceIndex];
  if (!member) return formation;
  if (!target) {
    if (sourceParty < 0) return formation;
    parties[sourceParty][sourceIndex] = null;
    waiting.push(member);
  } else {
    const displaced = parties[target.party][target.index] ?? null;
    if (sourceParty < 0) {
      if (displaced) waiting[sourceIndex] = displaced;
      else waiting.splice(sourceIndex, 1);
    } else parties[sourceParty][sourceIndex] = displaced;
    while (parties[target.party].length <= target.index) parties[target.party].push(null);
    parties[target.party][target.index] = member;
  }
  return { ...formation, parties, waiting };
}

export function editCell(formation: Formation, target: CellAddress, name: string, id: string): Formation {
  const previous = formation.parties[target.party][target.index];
  const value = name.trim();
  if (!value) return previous ? moveMember(formation, previous.id, null) : formation;
  const parties = formation.parties.map((party) => [...party]);
  while (parties[target.party].length <= target.index) parties[target.party].push(null);
  parties[target.party][target.index] = previous ? { ...previous, name: value }
    : { id, name: value, job: "", awakening: "" };
  return { ...formation, parties };
}
