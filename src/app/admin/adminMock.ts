/* 디자인 확인용 더미. 서버 배선 때 이 파일을 통째로 지운다. */

import { type Dow, type Member, type SurveyDef, type Vote, dowOf, isoOf, pad2, parseIso, rosterOf } from "./adminData";

export const NICKS = [
  "강철비", "고요한밤", "구름산책", "기린아", "꼬마마법사", "나비잠", "단풍놀이", "달빛여울",
  "도담도담", "돌풍", "라온제나", "마루한", "먹구름", "무쇠팔", "물비늘", "바람깃",
  "반달곰", "벼락치기", "별헤는밤", "봄눈", "붉은노을", "비단길", "사막여우", "산들바람",
  "새벽별", "서리꽃", "소나기", "솔바람", "순대국밥", "시린손", "아지랑이", "안개숲",
  "야근요정", "여명", "연꽃", "오로라", "옹고집", "우물안", "은하수", "이슬비",
  "자하문", "작은거인", "잔별", "저녁놀", "점심시간", "조용한칼", "주먹밥", "지평선",
  "진눈깨비", "찔레꽃", "차돌바기", "천둥소리", "첫눈", "초승달", "치즈덕후", "칼바람",
  "코딩노예", "콩나물국", "크림빵", "타는노을", "탱커장인", "파도소리", "팥빙수", "포근한",
  "풀벌레", "하늘색", "한여름밤", "해무리", "호랑나비", "흰눈썹",
];

export const JOBS = [
  "워리어", "레인저", "소서러", "자이언트", "무사", "매화", "발키리", "닌자", "쿠노이치",
  "다크나이트", "스트라이커", "미스틱", "란", "아처", "쇼그레", "노바", "세이지", "커세어",
  "드라카니아", "우드나", "마에그", "데드아이", "스카시아", "하시신", "워록",
];

export const GUILDS = ["백야", "달그림자", "서리길", "청람"];
export const LINE_POOL = ["전승", "각성", "전승", "각성", "전승", "각성", "기타", "각성", "전승", "전승"];

export const UNVOTED = [
  "은하수풀", "잿빛서리", "여울목", "밤안개숲", "청동거울", "돌미나리",
  "흰버들", "노을바치", "가랑비촌", "묵향길", "샛별지기", "참나무결",
];

export const SURVEYS: SurveyDef[] = [
  { key: "08.28", iso: "2026-08-28", dow: "금", battle: "20:00", open: "22:30", counts: { 참여: 58, 부속: 8, 늦참: 3, 미참: 1 } },
  { key: "08.27", iso: "2026-08-27", dow: "목", battle: "20:00", open: "22:30", counts: { 참여: 52, 부속: 11, 늦참: 4, 미참: 3 } },
  { key: "08.26", iso: "2026-08-26", dow: "수", battle: "20:00", open: "22:30", counts: { 참여: 61, 부속: 5, 늦참: 2, 미참: 2 } },
  { key: "08.25", iso: "2026-08-25", dow: "화", battle: "21:00", open: "22:30", counts: { 참여: 47, 부속: 12, 늦참: 6, 미참: 5 } },
  { key: "08.24", iso: "2026-08-24", dow: "월", battle: "20:00", open: "22:30", counts: { 참여: 55, 부속: 9, 늦참: 3, 미참: 3 } },
];

/* 공백 시간(거점전 종료 뒤 다음 오픈 전) 화면용 다음 회차 */
export const NEXT_SURVEY: SurveyDef = {
  key: "08.30", iso: "2026-08-30", dow: "일", battle: "20:00", open: "22:30",
  counts: { 참여: 0, 부속: 0, 늦참: 0, 미참: 0 },
};

export const QUEUE_FROM = new Date(2026, 7, 29);
export const QUEUE_DAYS = 14;

/* 설정 테이블 배선 전까지 쓰는 정원 프리셋과 자동 등록 규칙 초기값 */
export const DEFAULT_PRESETS = [55, 75, 100];

export const DEFAULT_RULE = {
  days: { 월: true, 화: true, 수: true, 목: true, 금: true, 토: false, 일: true } as Record<Dow, boolean>,
  battle: "21:00",
  open: "22:30",
  announceMinutes: 15,
  announceText: "",
};

function stamp(dateKey: string, totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${dateKey} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function nowStamp(dateKey: string) {
  const d = new Date();
  return stamp(dateKey, d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
}

export function buildMembers(survey: SurveyDef, offset: number): Member[] {
  const joinN = survey.counts["참여"];
  const subN = survey.counts["부속"];
  const topN = joinN + subN;
  // 부속 표가 한 곳에 몰려 보이지 않게 명단 사이사이에 끼운다
  const votes: Vote[] = Array.from({ length: topN }, () => "참여" as Vote);
  if (subN > 0) {
    const step = topN / subN;
    for (let i = 0; i < subN; i += 1) {
      let idx = Math.min(topN - 1, Math.round(i * step) + 2);
      while (votes[idx] === "부속") idx = (idx + 1) % topN;
      votes[idx] = "부속";
    }
  }

  const list: Member[] = [];
  let seq = 0;
  const mk = (vote: Vote, ord: number): Member => {
    const t = 57_600 + seq * 150 + ((seq * 37) % 59);
    const m: Member = {
      id: `v-${survey.key}-${seq}`,
      nick: NICKS[(seq + offset) % NICKS.length],
      guild: GUILDS[(seq * 3 + offset) % GUILDS.length],
      job: JOBS[(seq + offset) % JOBS.length],
      line: LINE_POOL[(seq * 7 + offset) % LINE_POOL.length],
      vote,
      ord,
      origSeq: ord + 1,
      time: vote === "미참" ? "-" : stamp(survey.key, t),
    };
    seq += 1;
    return m;
  };

  for (let i = 0; i < topN; i += 1) list.push(mk(votes[i], i));
  (["늦참", "미참"] as Vote[]).forEach((vote) => {
    for (let k = 0; k < survey.counts[vote]; k += 1) list.push(mk(vote, k));
  });
  return list;
}

// 시드를 고정해 새로고침해도 같은 목록이 나온다
export const PAST_SURVEYS: SurveyDef[] = (() => {
  const out: SurveyDef[] = [];
  let seed = 20260827;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const keyOf = (iso: string) => iso.slice(5).replace("-", ".");
  const d = parseIso("2026-08-27");
  while (out.length < 300) {
    const skip = d.getDay() === 6 || rnd() < 0.07;
    if (!skip) {
      const iso = isoOf(d);
      out.push({
        key: keyOf(iso),
        iso,
        dow: dowOf(d),
        battle: rnd() < 0.13 ? "21:00" : "20:00",
        open: "22:30",
        counts: { 참여: pick(50, 70), 부속: pick(5, 14), 늦참: pick(0, 6), 미참: pick(0, 5) },
      });
    }
    d.setDate(d.getDate() - 1);
  }
  return out;
})();

/* 라이브 유입 흉내. 배선 때 실데이터 조회로 바꾼다. */
const LIVE_LIMIT = 84;

export function mockLiveVote(prev: Member[], id: string, time: string): Member | null {
  if (prev.length >= LIVE_LIMIT) return null;
  const used = new Set(prev.map((m) => m.nick));
  const pool = NICKS.filter((n) => !used.has(n));
  if (pool.length === 0) return null;
  const next = rosterOf(prev).length;
  return {
    id,
    nick: pool[Math.floor(Math.random() * pool.length)],
    guild: GUILDS[Math.floor(Math.random() * GUILDS.length)],
    job: JOBS[Math.floor(Math.random() * JOBS.length)],
    line: LINE_POOL[Math.floor(Math.random() * LINE_POOL.length)],
    vote: Math.random() < 0.75 ? "참여" : "부속",
    ord: next,
    origSeq: next + 1,
    time,
  };
}
