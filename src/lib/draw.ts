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
/** 가로줄을 긋는 모양. 결과와 상관없고 그리는 모습만 다르다. */
export type RungShape = "straight" | "curve" | "wave";

export interface LadderRung {
  /** 왼쪽 세로줄에 닿는 높이. */
  row: number;
  left: number;
  /** 오른쪽 세로줄에 닿는 높이. 왼쪽과 다르면 비스듬한 가로줄이다. */
  rightRow: number;
  /** 높이가 같은 가로줄만 휘거나 출렁인다. */
  shape: RungShape;
}

/** 세로줄 한 토막이 반원으로 돌아가는 곳. 옆 줄로 건너가지 않으니 결과를 바꾸지 않는다. */
export interface LadderLoop {
  column: number;
  from: number;
  to: number;
  /** -1 이면 왼쪽으로, 1 이면 오른쪽으로 부푼다. */
  side: -1 | 1;
}
export interface Ladder {
  columns: number;
  rows: number;
  rungs: LadderRung[];
  loops: LadderLoop[];
}

/** 한 판에 설 수 있는 사람 수. 넘으면 조로 나눈다. */
export const MAX_PER_LADDER = 12;
/** 가로줄이 앉을 수 있는 높이의 가짓수. 가로줄 개수가 아니다. */
/* 층을 고르게 펴고 사이사이에 장식을 넣을 만큼 넉넉히 잡는다. */
export const LADDER_ROWS = 72;
/*
 * 맨 위·맨 아래에서 비워 두는 줄 수. 출발할 때와 도착한 뒤 프로필 사진이 세로줄 끝에
 * 서므로, 그 근처에 가로줄이나 반원이 있으면 사진에 가려지거나 사진을 뚫고 지나간다.
 */
export const EDGE_ROWS = 6;


/* 칸마다 상자(곧바로 되돌아오는 가로줄 한 쌍)를 몇 개 둘지. 사다리마다 하나를 고른다. */
const BOX_STYLES: [number, number][] = [[2, 4], [3, 5], [3, 6], [4, 6]];
const SLANT_CHANCE = 0.35;
const CURVE_CHANCE = 0.12;
const WAVE_CHANCE = 0.08;

/*
 * 사다리를 짠다.
 *
 * 가로줄을 무작위로 긋기만 하면 사람은 대개 출발한 자리 근처에 떨어진다. 가로줄 하나가
 * 옆 칸으로 한 칸씩만 옮기기 때문이다. 당첨 자리를 미리 보여 주면 "나는 멀어서 안 되겠다"가
 * 읽히고, 자리를 바꾸는 쪽은 당첨 자리 바로 위에 사람을 세워 확률을 올릴 수 있다.
 *
 * 그래서 거꾸로 짠다. 누가 어느 자리에 닿을지를 먼저 뽑는데, 모든 순서가 같은 확률이
 * 되게 뽑는다. 그 순서를 만드는 자리 바꾸기를 층층이 긋는다. 그러면 어느 열에서
 * 출발하든 어느 자리에나 같은 확률로 닿는다. 그 위에 결과를 바꾸지 않는 장식을 얹는다.
 * - 상자: 같은 칸에 가로줄 두 개를 두고, 그 사이 높이에는 양쪽 세로줄 모두 다른 가로줄
 *   끝을 두지 않는다. 건너갔다 곧바로 되돌아오므로 순서가 바뀌지 않는다. 비스듬하거나
 *   휘거나 출렁일 수 있다.
 * - 반원: 세로줄 한 토막이 옆으로 부풀어 돌아간다. 옆 줄로 건너가지 않는다.
 *
 * 길이 헷갈리지 않게, 한 세로줄에 가로줄 끝이 같은 높이나 바로 옆 높이로 오지 않고
 * 같은 칸의 가로줄은 떨어뜨리며 반원이 도는 높이에는 가로줄 끝을 두지 않는다.
 */
export function ladderPlan(columns: number, seed: string, rows = LADDER_ROWS): { ladder: Ladder; target: number[] } {
  const random = makeRandom(`rungs:${seed}`);
  const gaps = Math.max(0, columns - 1);
  const grid = (count: number) => Array.from({ length: count }, () => new Array<boolean>(rows).fill(false));
  /* 가로줄 끝이 실제로 닿은 곳과, 새 끝을 둘 수 없는 곳. */
  const endAt = grid(columns);
  const endBusy = grid(columns);
  /* 칸 안에서 새 가로줄이 걸칠 수 없는 높이. */
  const bandBusy = grid(gaps);
  /*
   * busy 는 보기 좋게 한 칸씩 더 띄운 것이고, 아래 둘은 결과가 틀리지 않는 데 꼭 필요한
   * 것만 적는다. 무작위로 자리를 못 찾은 칸을 채울 때는 이것만 지킨다.
   * sealed: 새 가로줄 끝을 둘 수 없는 곳(이미 있는 끝, 상자 안쪽, 반원 토막).
   * bandAt: 칸 안에서 가로줄이나 반원이 이미 걸친 높이.
   */
  const sealed = grid(columns);
  const bandAt = grid(gaps);
  const mark = (line: boolean[], from: number, to: number) => {
    for (let r = Math.max(0, from); r <= Math.min(rows - 1, to); r += 1) line[r] = true;
  };
  const free = (line: boolean[], from: number, to: number) => {
    for (let r = Math.max(0, from); r <= Math.min(rows - 1, to); r += 1) if (line[r]) return false;
    return true;
  };
  const shuffle = <T,>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const shapeOf = (): RungShape => {
    const roll = random();
    return roll < CURVE_CHANCE ? "curve" : roll < CURVE_CHANCE + WAVE_CHANCE ? "wave" : "straight";
  };
  const rungs: LadderRung[] = [];
  const put = (left: number, row: number, rightRow: number, shape: RungShape) => {
    const lo = Math.min(row, rightRow);
    const hi = Math.max(row, rightRow);
    rungs.push({ row, left, rightRow, shape });
    endAt[left][row] = true;
    endAt[left + 1][rightRow] = true;
    sealed[left][row] = true;
    sealed[left + 1][rightRow] = true;
    mark(bandAt[left], lo, hi);
    mark(endBusy[left], lo - 1, hi + 1);
    mark(endBusy[left + 1], lo - 1, hi + 1);
    mark(bandBusy[left], lo - 2, hi + 2);
  };

  // 1. 누가 어느 자리에 닿을지. target[출발 열] = 도착 자리. 모든 순서가 같은 확률이다.
  const target = shuffle(Array.from({ length: columns }, (_, i) => i));

  /*
   * 2. 그 순서를 만드는 자리 바꾸기를 층으로 나눈다. 한 층의 바꾸기끼리는 세로줄을 겹쳐
   *    쓰지 않는다. 앞쪽 층은 뒤바뀐 이웃 가운데 무작위로 고르고, 남은 층이 사람 수만큼
   *    되면 홀짝을 번갈아 정렬한다 — 홀짝 정렬은 사람 수만큼의 층이면 반드시 끝난다.
   */
  const at = Array.from({ length: columns }, (_, i) => i);
  const layers: number[][] = [];
  // 쓸 수 있는 높이는 EDGE_ROWS 부터 rows - 1 - EDGE_ROWS 까지다.
  const usable = rows - 2 * EDGE_ROWS;
  const maxLayers = Math.floor((usable - 2) / 3) + 1;
  const randomLayers = Math.max(0, maxLayers - columns);
  const outOfOrder = (p: number) => target[at[p]] > target[at[p + 1]];
  for (let k = 0; at.some((column, position) => target[column] !== position); k += 1) {
    const layer: number[] = [];
    if (k < randomLayers) {
      const taken = new Set<number>();
      for (const p of shuffle(Array.from({ length: gaps }, (_, i) => i).filter(outOfOrder))) {
        if (taken.has(p) || taken.has(p + 1)) continue;
        layer.push(p);
        taken.add(p);
        taken.add(p + 1);
      }
    } else {
      for (let p = (k - randomLayers) % 2; p + 1 < columns; p += 2) if (outOfOrder(p)) layer.push(p);
    }
    for (const p of layer) [at[p], at[p + 1]] = [at[p + 1], at[p]];
    if (layer.length) layers.push(layer);
  }

  // 3. 층을 높이 전체에 고르게 펴고, 층 안에서는 한 줄씩 흔들어 가지런하지 않게 한다.
  const pitch = layers.length > 1 ? Math.max(3, Math.floor((usable - 2) / (layers.length - 1))) : 3;
  const firstRow = EDGE_ROWS + (layers.length > 1 ? 0 : Math.floor((usable - 2) / 2));
  layers.forEach((layer, k) => {
    for (const p of layer) {
      const row = firstRow + k * pitch + (pitch >= 4 ? Math.floor(random() * 2) : 0);
      put(p, row, row, shapeOf());
    }
  });

  // 4. 반원. 가로줄 끝이 없는 토막에만 둔다.
  const loops: LadderLoop[] = [];
  const addLoop = (loop: LadderLoop) => {
    const gap = loop.side < 0 ? loop.column - 1 : loop.column;
    loops.push(loop);
    for (const line of [endBusy[loop.column], sealed[loop.column]]) mark(line, loop.from - 1, loop.to + 1);
    for (const line of [bandBusy[gap], bandAt[gap]]) mark(line, loop.from - 1, loop.to + 1);
  };
  if (columns >= 2) {
    const count = 1 + Math.floor(random() * Math.ceil(columns / 4));
    for (let tries = 0; loops.length < count && tries < count * 20; tries += 1) {
      const column = Math.floor(random() * columns);
      const side: -1 | 1 = column === 0 ? 1 : column === columns - 1 ? -1 : random() < 0.5 ? -1 : 1;
      const gap = side < 0 ? column - 1 : column;
      const length = 6 + Math.floor(random() * 4);
      const from = EDGE_ROWS + Math.floor(random() * Math.max(1, usable - length));
      const to = from + length;
      if (!free(endBusy[column], from - 1, to + 1) || !free(bandBusy[gap], from - 1, to + 1)) continue;
      addLoop({ column, from, to, side });
    }
    // 무작위로 하나도 못 놓았으면 위에서부터 훑어 들어갈 자리 하나를 찾는다.
    for (let column = 0; !loops.length && column < columns; column += 1) {
      for (const side of [-1, 1] as const) {
        const gap = side < 0 ? column - 1 : column;
        if (gap < 0 || gap >= gaps || loops.length) continue;
        for (let from = EDGE_ROWS; from + 6 <= rows - 1 - EDGE_ROWS && !loops.length; from += 1) {
          if (free(endBusy[column], from - 1, from + 7) && free(bandBusy[gap], from - 1, from + 7)) {
            addLoop({ column, from, to: from + 6, side });
          }
        }
      }
    }
  }

  // 5. 상자. 사다리 성격만큼 칸마다 두고, 가로줄이 두 개가 안 되는 칸에는 더 둔다.
  const [least, most] = BOX_STYLES[Math.floor(random() * BOX_STYLES.length)];
  const perGap = new Array<number>(gaps).fill(0);
  for (const rung of rungs) perGap[rung.left] += 1;
  const slant = () => (random() < SLANT_CHANCE ? (random() < 0.5 ? -1 : 1) * (2 + Math.floor(random() * 2)) : 0);
  for (let left = 0; left < gaps; left += 1) {
    let boxes = least + Math.floor(random() * (most - least + 1));
    for (let tries = 0; tries < 80 && (boxes > 0 || perGap[left] < 2); tries += 1) {
      const a1 = EDGE_ROWS + Math.floor(random() * Math.max(1, usable - 8));
      const b1 = a1 + slant();
      const a2 = a1 + 4 + Math.floor(random() * 5);
      const b2 = a2 + slant();
      const lo = Math.min(a1, b1);
      const hi = Math.max(a2, b2);
      if (lo < EDGE_ROWS || hi > rows - 1 - EDGE_ROWS || a2 - a1 < 4 || b2 - b1 < 4) continue;
      if (!free(bandBusy[left], lo, hi)) continue;
      if (endBusy[left][a1] || endBusy[left][a2] || endBusy[left + 1][b1] || endBusy[left + 1][b2]) continue;
      // 상자 안쪽 높이에 양쪽 세로줄 모두 다른 가로줄 끝이 없어야 곧바로 되돌아온다.
      if (!free(endAt[left], lo - 1, hi + 1) || !free(endAt[left + 1], lo - 1, hi + 1)) continue;
      put(left, a1, b1, a1 === b1 ? shapeOf() : "straight");
      put(left, a2, b2, a2 === b2 ? shapeOf() : "straight");
      // 나중에 오는 가로줄이 상자 안쪽에 끝을 두면 되돌아오지 않는다. 안쪽 전체를 막아 둔다.
      mark(endBusy[left], lo - 1, hi + 1);
      mark(endBusy[left + 1], lo - 1, hi + 1);
      mark(bandBusy[left], lo - 2, hi + 2);
      mark(sealed[left], lo, hi);
      mark(sealed[left + 1], lo, hi);
      perGap[left] += 2;
      boxes -= 1;
    }
    /*
     * 그래도 가로줄이 두 개가 안 되면 사다리가 둘로 쪼개져 보인다. 위에서부터 훑어
     * 곧은 상자 하나가 들어갈 자리를 찾는다. 이때는 결과에 꼭 필요한 간격만 지킨다.
     */
    for (const height of [3, 2]) {
      for (let top = EDGE_ROWS; perGap[left] < 2 && top + height <= rows - 1 - EDGE_ROWS; top += 1) {
        const bottom = top + height;
        if (!free(sealed[left], top, bottom) || !free(sealed[left + 1], top, bottom) || !free(bandAt[left], top, bottom)) continue;
        put(left, top, top, "straight");
        put(left, bottom, bottom, "straight");
        mark(sealed[left], top, bottom);
        mark(sealed[left + 1], top, bottom);
        perGap[left] += 2;
      }
    }
  }

  rungs.sort((a, b) => a.row - b.row || a.left - b.left);
  return { ladder: { columns, rows, rungs, loops }, target };
}

export function makeLadder(columns: number, seed: string, rows = LADDER_ROWS): Ladder {
  return ladderPlan(columns, seed, rows).ladder;
}

/*
 * 걷는 거리를 재는 방법. 세로로 끝까지 내려가는 거리는 사다리 깊이와 상관없이
 * DESCENT 로 치고, 옆 칸으로 한 번 건너가는 거리는 CROSSING 으로 친다. 가로줄이
 * 많은 사다리에서도 한 판이 지나치게 길어지지 않게 건너가기를 조금 가볍게 둔다.
 */
const DESCENT = 13;
const CROSSING = 0.4;

/** 한 사람이 지나가는 길. 좌표는 칸 단위다. */
export interface LadderRoute {
  points: [number, number][];
  /** points[i] 까지 온 거리. */
  distances: number[];
  total: number;
  /** 도착 자리. traceLadder 와 늘 같다. */
  land: number;
}

/*
 * 화면에 그릴 길. 결과를 정하는 것은 traceLadder 이고 이 함수는 그림만 만든다 —
 * 둘이 어긋나면 그림이 거짓말을 하므로 도착 자리를 함께 돌려주고 검사한다.
 * 세로줄 가운데가 x = 열 + 0.5, 가로줄 한 줄이 y = 줄 + 1.5 이다.
 */
export function routesOf(ladder: Ladder): LadderRoute[] {
  const ends = endsByColumn(ladder);
  const rowWeight = DESCENT / (ladder.rows + 1);
  return Array.from({ length: ladder.columns }, (_, start) => {
    let column = start;
    const points: [number, number][] = [[column + 0.5, 0.5]];
    for (const step of crossingsOf(ends, start)) {
      points.push([step.column + 0.5, step.row + 1.5], [step.toColumn + 0.5, step.toRow + 1.5]);
      column = step.toColumn;
    }
    points.push([column + 0.5, ladder.rows + 1.5]);
    const distances = [0];
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      distances.push(distances[i - 1] + Math.abs(x1 - x0) * CROSSING + Math.abs(y1 - y0) * rowWeight);
    }
    return { points, distances, total: distances[distances.length - 1], land: column };
  });
}

/** 세로줄 하나에 닿은 가로줄 끝. 여기서 올라타면 toColumn 의 toRow 로 내린다. */
interface RungEnd {
  row: number;
  toColumn: number;
  toRow: number;
}

function endsByColumn(ladder: Ladder): RungEnd[][] {
  const ends = Array.from({ length: ladder.columns }, () => [] as RungEnd[]);
  for (const rung of ladder.rungs) {
    ends[rung.left].push({ row: rung.row, toColumn: rung.left + 1, toRow: rung.rightRow });
    ends[rung.left + 1].push({ row: rung.rightRow, toColumn: rung.left, toRow: rung.row });
  }
  for (const list of ends) list.sort((a, b) => a.row - b.row);
  return ends;
}

/*
 * 한 사람이 건너는 가로줄을 차례로 돌려준다. 세로줄을 따라 내려가다 가로줄 끝을 만나면
 * 반대쪽 끝으로 옮겨 가 거기서부터 다시 내려간다. 비스듬한 가로줄은 오르막일 수도 있다.
 *
 * 가로줄 끝 하나에서 나가는 길은 하나뿐이고 들어오는 길도 하나뿐이라, 같은 끝을 두 번
 * 밟거나 두 사람이 한 자리에 닿는 일은 없다. 상한은 만일에 대비한 것이다.
 */
function crossingsOf(ends: RungEnd[][], start: number) {
  const steps: { column: number; row: number; toColumn: number; toRow: number }[] = [];
  let column = start;
  let row = -1;
  for (let guard = 0; guard < 100000; guard += 1) {
    const next = ends[column].find((end) => end.row > row);
    if (!next) break;
    steps.push({ column, row: next.row, toColumn: next.toColumn, toRow: next.toRow });
    column = next.toColumn;
    row = next.toRow;
  }
  return steps;
}

/** 각 열에서 출발해 어디에 닿는지. land[출발 열] = 도착 자리. */
export function traceLadder(ladder: Ladder): number[] {
  const ends = endsByColumn(ladder);
  return Array.from({ length: ladder.columns }, (_, start) => {
    const steps = crossingsOf(ends, start);
    return steps.length ? steps[steps.length - 1].toColumn : start;
  });
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
