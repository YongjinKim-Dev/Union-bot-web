/*
 * 추첨.
 *
 * 뽑는 일 자체는 씨앗 하나로 정해진다. 같은 씨앗과 같은 참여자 목록이면 언제
 * 어디서 돌려도 같은 결과가 나온다. 그래야 "조작 아니냐" 에 답할 수 있다 —
 * 씨앗을 먼저 내보이고 뽑으면, 나중에 누구든 같은 결과를 다시 만들어 볼 수 있다.
 *
 * 그래서 Math.random 을 쓰지 않는다. 그것은 되돌릴 수 없다.
 *
 * 화면(사다리·마블 따위)은 이 결과를 보여주기만 한다. 보여주는 방법이 늘어도
 * 뽑는 규칙은 여기 하나뿐이다.
 */

export interface DrawEntry {
  /** 회원이면 user.id, 명단에 손으로 적은 이름이면 비어 있다. */
  userId: string | null;
  nickname: string;
}

export interface DrawOutcome {
  seed: string;
  /** 뽑힌 순서대로 늘어놓은 전체 참여자. 앞에서부터 당첨이다. */
  order: DrawEntry[];
  winners: DrawEntry[];
  losers: DrawEntry[];
}

/** 씨앗은 사람이 옮겨 적을 수 있어야 한다. 헷갈리는 글자는 뺀다. */
const SEED_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SEED_LENGTH = 12;

export function randomSeed(): string {
  const bytes = new Uint8Array(SEED_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join("");
}

export function isValidSeed(seed: string): boolean {
  return seed.length === SEED_LENGTH && [...seed].every((c) => SEED_ALPHABET.includes(c));
}

/* 글자열을 32비트 숫자 네 개로 흩는다(xmur3). */
function seedState(seed: string): [number, number, number, number] {
  let h = 1779033703 ^ seed.length;
  const next = () => {
    for (let i = 0; i < seed.length; i += 1) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  return [next(), next(), next(), next()];
}

/* sfc32. 씨앗만 같으면 어느 기기에서 돌려도 같은 수열이 나온다. */
function makeRandom(seed: string): () => number {
  let [a, b, c, d] = seedState(seed);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/*
 * 참여자 목록의 순서가 결과를 바꾸므로, 넣은 순서와 상관없이 같은 결과가
 * 나오도록 이름순으로 세운 뒤 섞는다. 그래야 명단을 어떤 순서로 붙여넣든
 * 같은 씨앗이면 같은 결과가 된다.
 */
export function runDraw(entries: DrawEntry[], pickCount: number, seed: string): DrawOutcome {
  const sorted = [...entries].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
  const random = makeRandom(seed);
  // 뒤에서부터 자리를 정하는 피셔–예이츠. 치우침이 없다.
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  const picks = Math.max(0, Math.min(pickCount, sorted.length));
  return { seed, order: sorted, winners: sorted.slice(0, picks), losers: sorted.slice(picks) };
}

/* ── 사다리 ── */

/** 가로줄 하나. row 번째 칸에서 left 열과 left+1 열을 잇는다. */
export interface LadderRung {
  row: number;
  left: number;
}
export interface Ladder {
  columns: number;
  rows: number;
  rungs: LadderRung[];
}

/** 한 판에 설 수 있는 사람 수. 넘으면 조로 나눈다. */
export const MAX_PER_LADDER = 12;
/** 사다리 깊이. 열두 명이 서로 충분히 엇갈릴 만큼. */
export const LADDER_ROWS = 12;

/*
 * 가로줄을 무작위로 긋는다. 한 칸 안에서 이웃한 가로줄이 붙으면 한 자리에서
 * 길이 양쪽으로 갈려 따라갈 수 없으므로, 하나를 놓으면 다음 자리는 건너뛴다.
 */
export function makeLadder(columns: number, seed: string, rows = LADDER_ROWS): Ladder {
  const random = makeRandom(`rungs:${seed}`);
  const rungs: LadderRung[] = [];
  for (let row = 0; row < rows; row += 1) {
    let c = 0;
    while (c + 1 < columns) {
      if (random() < 0.5) { rungs.push({ row, left: c }); c += 2; } else c += 1;
    }
  }
  return { columns, rows, rungs };
}

/** 각 열에서 출발해 어디에 닿는지. land[출발 열] = 도착 자리. */
export function traceLadder(ladder: Ladder): number[] {
  const at = Array.from({ length: ladder.columns }, (_, i) => i);
  for (let row = 0; row < ladder.rows; row += 1) {
    for (const rung of ladder.rungs) {
      if (rung.row !== row) continue;
      [at[rung.left], at[rung.left + 1]] = [at[rung.left + 1], at[rung.left]];
    }
  }
  const land = new Array<number>(ladder.columns);
  at.forEach((column, position) => { land[column] = position; });
  return land;
}

/*
 * 당첨이 걸린 도착 자리.
 *
 * 사다리는 구조상 왼쪽 열이 앞자리에 닿기 쉽다 — 열두 명·열두 칸이면 1번 열이
 * 1번 자리에 닿을 확률이 27%, 12번 열은 0%다. 그래서 당첨 자리를 고정하면 왼쪽에
 * 선 사람이 크게 유리하다.
 *
 * 당첨 자리를 균등하게 뽑으면 그 치우침이 정확히 상쇄된다. 어느 열이든 어딘가에는
 * 반드시 닿으므로, 도착 자리 전체에 당첨을 고르게 뿌리면 모든 열의 당첨 확률이
 * 같아진다(실측 편차 1.9%). 그래서 사람들이 어느 자리에 서든 손해가 없다.
 */
export function pickWinningSlots(columns: number, pickCount: number, seed: string): number[] {
  const slots = Array.from({ length: columns }, (_, i) => i);
  const random = makeRandom(`slots:${seed}`);
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots.slice(0, Math.max(0, Math.min(pickCount, columns))).sort((a, b) => a - b);
}

/* ── 조 나누기 ── */

export interface DrawGroup {
  /** 이 조의 열 순서. 운영진이 바꿀 수 있다. */
  columns: DrawEntry[];
  ladder: Ladder;
  /** 당첨이 걸린 도착 자리. 스타트 전에는 화면에 내보이지 않는다. */
  winningSlots: number[];
  pick: number;
}
export interface DrawRound {
  groups: DrawGroup[];
}

/** 사다리를 따라간 결과. 도착 자리가 당첨 자리에 걸린 사람이 뽑힌 것이다. */
export function winnersOf(group: DrawGroup): DrawEntry[] {
  const land = traceLadder(group.ladder);
  const won = new Set(group.winningSlots);
  return group.columns.filter((_, column) => won.has(land[column]));
}

/** n 명을 최대 size 씩, 되도록 고르게 나눈 크기 목록. */
function splitSizes(n: number, size: number): number[] {
  return distribute(n, Math.ceil(n / size));
}

/** total 을 parts 몫으로 되도록 고르게 나눈다. */
function distribute(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/*
 * 한 라운드를 짠다.
 *
 * 어느 조에 들어가는지는 씨앗이 정한다. 조 크기가 하나만 달라도 작은 조가
 * 유리하기 때문이다 — 스물다섯을 9·8·8 로 나눠 3·2·2 명을 뽑으면 아홉 명 조가
 * 33% 유리하다(실측 19.3%). 씨앗으로 무작위 배정하면 그 차이가 사라진다
 * (실측 0.4%). 그래서 조 배정만은 손대지 못하게 한다.
 *
 * 조 안에서 몇 번째 열에 서는지는 얼마든지 바꿔도 된다. 당첨 자리를 균등하게
 * 뽑으므로 어느 열이든 확률이 같다.
 */
export function buildRound(entries: DrawEntry[], pickCount: number, seed: string, roundKey: string): DrawRound {
  const shuffled = runDraw(entries, 0, `assign:${roundKey}:${seed}`).order;
  const sizes = splitSizes(shuffled.length, MAX_PER_LADDER);
  const picks = distribute(Math.min(pickCount, shuffled.length), sizes.length);
  const groups: DrawGroup[] = [];
  let cursor = 0;
  for (const [i, size] of sizes.entries()) {
    const columns = shuffled.slice(cursor, cursor + size);
    cursor += size;
    const pick = Math.min(size, picks[i] ?? 0);
    const key = `${roundKey}:${i}`;
    groups.push({
      columns,
      ladder: makeLadder(size, `${key}:${seed}`),
      winningSlots: pickWinningSlots(size, pick, `${key}:${seed}`),
      pick,
    });
  }
  return { groups };
}

export interface DrawPlan {
  seed: string;
  rounds: DrawRound[];
  winners: DrawEntry[];
}

/*
 * 라운드를 이어 붙인다. 한 라운드에서 뽑힌 사람이 다음 라운드에 선다.
 *
 * 라운드마다 조 배정을 다시 섞으므로, 각 라운드에서 그 자리에 선 사람들은
 * 모두 같은 확률로 올라간다. 그것이 겹쳐도 처음 참여한 모두의 확률은 같다.
 */
export function planDraw(entries: DrawEntry[], pickCount: number, seed: string): DrawPlan {
  const rounds: DrawRound[] = [];
  let current = entries;
  for (let index = 0; current.length > pickCount; index += 1) {
    // 다음 라운드가 한 판에 들어가고, 뽑을 인원보다는 많아야 겨룰 거리가 남는다.
    const round = buildRound(current, nextAdvanceCount(current.length, pickCount), seed, `r${index}`);
    rounds.push(round);
    current = round.groups.flatMap((g) => winnersOf(g));
  }
  if (!rounds.length) rounds.push(buildRound(current, Math.min(pickCount, current.length), seed, "r0"));
  return { seed, rounds, winners: current };
}

/** 이번 라운드에서 몇 명을 올릴지. 뽑을 인원보다는 늘 많거나 같다. */
export function nextAdvanceCount(remaining: number, pickCount: number): number {
  if (remaining <= MAX_PER_LADDER) return Math.min(pickCount, remaining);
  const groupCount = Math.ceil(remaining / MAX_PER_LADDER);
  return Math.max(
    pickCount,
    Math.min(remaining - 1, Math.max(groupCount, pickCount + Math.ceil(groupCount / 2))),
  );
}

/*
 * 자리 배치까지 받아 그대로 다시 돌린다.
 *
 * 배치는 운영진이 정하므로 씨앗만으로는 결과를 알 수 없다. 그래서 남길 때
 * 배치를 함께 받아 서버가 직접 다시 돌린다 — 화면이 보낸 당첨자를 그대로 믿으면
 * 기록이 기록 구실을 못 한다.
 */
export function replayDraw(
  entries: DrawEntry[],
  pickCount: number,
  seed: string,
  arrangements: string[][][],
): { winners: DrawEntry[]; rounds: DrawRound[] } | null {
  const byName = new Map(entries.map((e) => [e.nickname, e]));
  const rounds: DrawRound[] = [];
  let current = entries;
  for (const [index, arrangement] of arrangements.entries()) {
    if (current.length <= pickCount) return null;
    const round = buildRound(current, nextAdvanceCount(current.length, pickCount), seed, `r${index}`);
    if (round.groups.length !== arrangement.length) return null;
    for (const [g, group] of round.groups.entries()) {
      const wanted = arrangement[g];
      // 배치는 자리만 바꾼 것이어야 한다. 사람이 늘거나 줄면 받아들이지 않는다.
      if (wanted.length !== group.columns.length) return null;
      const had = new Set(group.columns.map((e) => e.nickname));
      if (!wanted.every((name) => had.has(name)) || new Set(wanted).size !== wanted.length) return null;
      group.columns = wanted.map((name) => byName.get(name)!);
    }
    rounds.push(round);
    current = round.groups.flatMap((g) => winnersOf(g));
  }
  if (current.length !== pickCount) return null;
  return { winners: current, rounds };
}
