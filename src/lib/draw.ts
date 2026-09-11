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

/*
 * 뽑힌 결과를 실제로 만들어 내는 사다리를 짓는다.
 *
 * 그림만 그럴싸하게 그리고 결과를 따로 발표하면 그건 사다리가 아니다. 손가락으로
 * 따라 내려가면 발표한 그 자리에 닿아야 한다. 그래서 결과에서 거꾸로 사다리를
 * 짓는다 — 뽑기는 runDraw 가 이미 고르게 했고, 사다리는 그것을 보여 줄 뿐이다.
 *
 * 이웃한 두 열을 바꾸는 것이 가로줄 하나다. 홀짝 번갈아 훑으면 한 칸 안에서
 * 가로줄이 서로 겹치지 않는다 — 한 자리에서 양쪽으로 길이 갈리면 따라갈 수 없다.
 */
export function buildLadder(finalOrder: number[]): Ladder {
  const n = finalOrder.length;
  const work = [...finalOrder];
  const swaps: LadderRung[] = [];
  let row = 0;
  for (let pass = 0; pass < n && !work.every((v, i) => v === i); pass += 1) {
    let moved = false;
    for (let c = pass % 2; c + 1 < n; c += 2) {
      if (work[c] > work[c + 1]) {
        [work[c], work[c + 1]] = [work[c + 1], work[c]];
        swaps.push({ row, left: c });
        moved = true;
      }
    }
    if (moved) row += 1;
  }
  // 위 과정은 "도착 줄 → 출발 줄" 이므로, 내려가는 사다리는 칸 순서를 뒤집는다.
  const rows = Math.max(row, 1);
  return { columns: n, rows, rungs: swaps.map((s) => ({ row: rows - 1 - s.row, left: s.left })) };
}

/** 각 열에서 출발해 어디에 닿는지. 결과 배열의 index 가 도착 자리다. */
export function traceLadder(ladder: Ladder): number[] {
  const at = Array.from({ length: ladder.columns }, (_, i) => i);
  for (let r = 0; r < ladder.rows; r += 1) {
    for (const rung of ladder.rungs) {
      if (rung.row !== r) continue;
      [at[rung.left], at[rung.left + 1]] = [at[rung.left + 1], at[rung.left]];
    }
  }
  return at;
}
