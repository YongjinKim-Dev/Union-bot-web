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

export const SHEET = {
  names: ["1부대(본대)", "2부대(본대)", "3부대(수비)", "4부대(본대/기둥)"],
  colors: ["#E8F4F8", "#F0F8E8", "#FFF8E8", "#F8E8F0"],
  columnWidth: 140,
  rowHeight: 22,
  headerHeight: 35,
  font: 'Arial, "Malgun Gothic", sans-serif',
};

export function emptyFormation(): Formation {
  return { parties: [[], [], [], []], waiting: [], rows: 10 };
}

export function memberLabel(member: SquadMember | null | undefined, showJobs: boolean): string {
  if (!member) return "";
  if (!showJobs || !member.job) return member.name;
  const tag = member.name.match(/\((빌더|흑정|대포|대포컷|불퇴|신기전|화염탑|코끼리|수비|샤이|자이언트)\)$/);
  if (tag && !["수비", "샤이", "자이언트"].includes(tag[1])) return member.name;
  const name = tag ? member.name.slice(0, -tag[0].length) : member.name;
  const specialization = member.awakening === "각성" ? "각·" : member.awakening === "전승" ? "전·" : "";
  return `${name}(${tag?.[1] === "수비" ? "수비 · " : ""}${specialization}${member.job})`;
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

// 첨부한 Google Apps Script의 고정 배치 → 직업 순환 배치 → 순차 배치 순서를 유지한다.
export function autoAssign(members: SquadMember[]): Formation {
  const sizes = members.length >= 70 ? [20, 20, 15, 20]
    : members.length >= 50 ? [15, 15, 14, 11]
      : Array.from({ length: 4 }, (_, i) => Math.floor(members.length / 4) + (i < members.length % 4 ? 1 : 0));
  const parties: SquadMember[][] = [[], [], [], []];
  const assigned = new Set<string>();
  function place(member: SquadMember, party: number, suffix = "") {
    parties[party].push({ ...member, name: member.name + suffix });
    assigned.add(member.id);
  }
  function fixed(name: string, party: number, suffix = "") {
    const member = members.find((m) => m.name === name && !assigned.has(m.id));
    if (!member) return false;
    place(member, party, suffix);
    return true;
  }

  fixed("예니체리", 0);
  fixed("홍줭", 1);
  fixed("사색가", 2, "(빌더)");
  fixed("Wheel", 3);
  fixed("마창", 0, "(흑정)");
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
      place(member, party, job === "샤이" || job === "자이언트" ? `(${job})` : "");
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
