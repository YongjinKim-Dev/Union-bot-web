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
 * 이웃한 두 열을 바꾸는 것이 가로줄 하나다. 한 칸 안에서 가로줄이 서로 붙으면
 * 한 자리에서 길이 양쪽으로 갈려 따라갈 수 없으므로, 겹치지 않게만 놓는다.
 *
 * 어느 것을 먼저 놓을지는 씨앗으로 고른다. 왼쪽부터 차례로 놓으면 가로줄이 고른
 * 계단 모양으로 늘어서서, 무작위로 뽑은 결과인데도 짜 놓은 것처럼 보인다.
 */
export function buildLadder(finalOrder: number[], seed: string): Ladder {
  const n = finalOrder.length;
  const work = [...finalOrder];
  const swaps: LadderRung[] = [];
  const random = makeRandom(`ladder:${seed}`);
  let row = 0;
  // 한 번에 하나도 못 놓는 일은 없으므로 뒤바뀐 쌍의 수만큼이면 반드시 끝난다.
  for (let guard = 0; guard <= n * n && !work.every((v, i) => v === i); guard += 1) {
    const candidates: number[] = [];
    for (let c = 0; c + 1 < n; c += 1) if (work[c] > work[c + 1]) candidates.push(c);
    let placed = 0;
    let lastUsed = -2;
    for (const c of candidates) {
      // 바로 옆에 이미 놓았으면 건너뛴다. 그 밖에는 절반쯤 무작위로 미룬다.
      if (c - lastUsed < 2) continue;
      if (placed > 0 && random() < 0.25) continue;
      [work[c], work[c + 1]] = [work[c + 1], work[c]];
      swaps.push({ row, left: c });
      lastUsed = c;
      placed += 1;
    }
    if (placed === 0 && candidates.length > 0) {
      // 전부 미뤘으면 맨 앞 하나는 반드시 놓아 앞으로 나아간다.
      const c = candidates[0];
      [work[c], work[c + 1]] = [work[c + 1], work[c]];
      swaps.push({ row, left: c });
      placed = 1;
    }
    if (placed > 0) row += 1;
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

/* ── 조 나누기 ── */

/** 사다리 하나에 설 수 있는 사람 수. 넘으면 조로 나눈다. */
export const MAX_PER_LADDER = 12;

export interface DrawGroup {
  /** 이 조의 출발 순서. 사다리 열 순서 그대로다. */
  entries: DrawEntry[];
  /** 이 조에서 올라가는 인원. */
  pick: number;
  /** 올라간 사람. 전체 섞기가 정한 순서에서 앞선 쪽이다. */
  advancing: DrawEntry[];
}
export interface DrawRound {
  groups: DrawGroup[];
}
export interface DrawPlan extends DrawOutcome {
  rounds: DrawRound[];
}

/** n 명을 최대 size 씩, 되도록 고르게 나눈 크기 목록. */
function splitSizes(n: number, size: number): number[] {
  const count = Math.ceil(n / size);
  const base = Math.floor(n / count);
  const extra = n % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/*
 * 뽑기는 전체를 한 번에 고르게 섞어서 정한다(runDraw). 조 나누기는 그 결과를
 * 열두 명씩 나눠 보여 주기 위한 것이다.
 *
 * 조를 나눈 뒤에 조마다 따로 뽑으면, 조 크기가 하나만 달라도 그 조에 든 사람이
 * 유리해진다. 스물다섯을 9·8·8 로 나눠 한 명씩 뽑으면 여덟 명 조가 12.5% 유리
 * 하다. 그래서 조는 화면을 위한 것이고 확률은 전체 섞기 하나가 책임진다.
 *
 * 각 조에서 올라가는 사람은 전체 순서에서 앞선 쪽이다. 사다리를 따라가면 그
 * 사람들에게 닿으므로, 보는 사람에게는 조에서 진짜로 뽑힌 것과 같다.
 */
export function planDraw(entries: DrawEntry[], pickCount: number, seed: string): DrawPlan {
  const outcome = runDraw(entries, pickCount, seed);
  const rankOf = new Map(outcome.order.map((entry, i) => [entry.nickname, i]));
  const byRank = (a: DrawEntry, b: DrawEntry) => rankOf.get(a.nickname)! - rankOf.get(b.nickname)!;
  const isWinner = new Set(outcome.winners.map((e) => e.nickname));

  const cut = (people: DrawEntry[], sizes: number[]) => {
    const out: DrawEntry[][] = [];
    let cursor = 0;
    for (const size of sizes) { out.push(people.slice(cursor, cursor + size)); cursor += size; }
    return out;
  };

  const rounds: DrawRound[] = [];
  let current = [...outcome.order];
  for (let round = 0; ; round += 1) {
    /*
     * 조 배정은 뽑은 순위와 따로 섞는다. 순위 순서로 자르면 앞 조에 당첨자가
     * 몰려, 사다리를 돌리기도 전에 어느 조가 유리한지 드러난다.
     */
    current = runDraw(current, 0, `groups:${round}:${seed}`).order;
    const sizes = splitSizes(current.length, MAX_PER_LADDER);

    // 한 판에 다 들어가면 여기서 끝낸다.
    if (sizes.length === 1) {
      rounds.push({
        groups: [{ entries: current, pick: Math.min(pickCount, current.length), advancing: [...outcome.winners] }],
      });
      break;
    }

    // 다음 라운드가 한 판에 들어가고, 뽑을 인원보다는 많아야 겨룰 거리가 남는다.
    const wanted = Math.min(
      MAX_PER_LADDER,
      current.length - 1,
      Math.max(sizes.length, pickCount + Math.ceil(sizes.length / 2)),
    );
    const share = splitSizes(wanted, Math.ceil(wanted / sizes.length));
    const groups: DrawGroup[] = cut(current, sizes).map((members, i) => {
      /*
       * 이 조에 있는 당첨자는 모두 올려야 한다. 몫만 보고 자르면 당첨자가 중간
       * 라운드에서 떨어져 마지막 발표와 어긋난다.
       */
      const mustAdvance = members.filter((m) => isWinner.has(m.nickname)).length;
      const pick = Math.min(members.length, Math.max(share[i] ?? 1, mustAdvance, 1));
      return { entries: [...members], pick, advancing: [...members].sort(byRank).slice(0, pick) };
    });
    rounds.push({ groups });

    const next = groups.flatMap((g) => g.advancing);
    // 당첨자가 많아 더 줄지 않으면, 마지막 라운드를 조로 나눠 치른다.
    if (next.length >= current.length) {
      const finalSizes = splitSizes(current.length, MAX_PER_LADDER);
      rounds[rounds.length - 1] = {
        groups: cut(current, finalSizes).map((members) => {
          const winnersHere = members.filter((m) => isWinner.has(m.nickname));
          return { entries: [...members], pick: winnersHere.length, advancing: winnersHere };
        }),
      };
      break;
    }
    current = next;
  }
  return { ...outcome, rounds };
}
