import type { LadderRoute } from "@/lib/draw";

/*
 * 네모 사다리의 그림 변형. 가로줄이 어디에 있고 누가 어디에 닿는지는 그대로이고,
 * 선을 어떻게 긋는지만 다르다. 그래서 결과에도 서버의 다시 돌리기에도 영향이 없다.
 */
export type LadderVariant = "straight" | "curve" | "wave" | "rounded";

/* 라운드마다 이 가운데서 하나를 고른다. */
const MIXED: LadderVariant[] = ["curve", "wave", "rounded"];

export function randomVariant(): LadderVariant {
  return MIXED[Math.floor(Math.random() * MIXED.length)];
}

/* 크기는 줄(세로)·칸(가로) 단위다. 같은 칸의 가로줄은 세 줄, 이웃 칸과는 두 줄 떨어져 있다. */
const CURVE_SAG = 1.4;
const WAVE_HEIGHT = 1.0;
const ROUND_ROWS = 1.5;
const ROUND_COLUMNS = 0.25;
const PIECES = 12;

type Point = [number, number];

/** 가로줄 왼쪽 끝에서 t(0~1)만큼 간 곳이 곧은 선에서 아래로 얼마나 벗어나는지. */
function bend(variant: LadderVariant, t: number): number {
  if (variant === "curve") return CURVE_SAG * 4 * t * (1 - t);
  if (variant === "wave") return WAVE_HEIGHT * Math.sin(2 * Math.PI * t);
  return 0;
}

/** 휘는 가로줄의 점들. 곧은 가로줄이면 null — 선 하나로 그리면 된다. */
export function rungPoints(variant: LadderVariant, left: number, y: number): string | null {
  if (variant !== "curve" && variant !== "wave") return null;
  return Array.from({ length: PIECES + 1 }, (_, k) => {
    const t = k / PIECES;
    return `${left + 0.5 + t},${y + bend(variant, t)}`;
  }).join(" ");
}

/*
 * 사람이 걷는 길을 변형에 맞춰 다시 짠다.
 *
 * 새로 넣는 점마다 원래 구간의 거리를 나눠 준다. 곡선이 조금 길어져도 걷는 시간은
 * 곧은 사다리와 같고, 누가 먼저 닿는지도 바뀌지 않는다.
 */
export function drawnRoute(route: LadderRoute, variant: LadderVariant): LadderRoute {
  if (variant === "straight") return route;
  if (variant === "rounded") return roundCorners(route);
  const points: Point[] = [route.points[0]];
  const distances = [route.distances[0]];
  for (let i = 1; i < route.points.length; i += 1) {
    const [x0, y0] = route.points[i - 1];
    const [x1, y1] = route.points[i];
    const d0 = route.distances[i - 1];
    const d1 = route.distances[i];
    if (x0 !== x1) {
      // 옆 칸으로 건너가는 구간이다. 그 가로줄과 똑같은 곡선 위를 지나게 한다.
      const left = Math.min(x0, x1);
      for (let k = 1; k < PIECES; k += 1) {
        const x = x0 + ((x1 - x0) * k) / PIECES;
        points.push([x, y0 + bend(variant, x - left)]);
        distances.push(d0 + ((d1 - d0) * k) / PIECES);
      }
    }
    points.push([x1, y1]);
    distances.push(d1);
  }
  return { ...route, points, distances };
}

/*
 * 꺾이는 곳을 둥글게 깎는다. 모서리 앞뒤로 조금씩 잘라 내고 그 사이를 곡선으로 잇는다.
 * 잘라 내는 길이는 구간의 절반을 넘지 않아, 모서리가 연달아 와도 서로 겹치지 않는다.
 */
function roundCorners(route: LadderRoute): LadderRoute {
  const { points: source, distances: at } = route;
  if (source.length < 3) return route;
  const points: Point[] = [source[0]];
  const distances = [at[0]];
  for (let i = 1; i < source.length - 1; i += 1) {
    const [px, py] = source[i - 1];
    const [cx, cy] = source[i];
    const [nx, ny] = source[i + 1];
    const inAcross = cx !== px;
    const outAcross = nx !== cx;
    if (inAcross === outAcross) {
      points.push(source[i]);
      distances.push(at[i]);
      continue;
    }
    const inLength = Math.abs(cx - px) + Math.abs(cy - py);
    const outLength = Math.abs(nx - cx) + Math.abs(ny - cy);
    const cutIn = Math.min(inAcross ? ROUND_COLUMNS : ROUND_ROWS, inLength / 2);
    const cutOut = Math.min(outAcross ? ROUND_COLUMNS : ROUND_ROWS, outLength / 2);
    const from: Point = inAcross ? [cx - Math.sign(cx - px) * cutIn, cy] : [cx, cy - Math.sign(cy - py) * cutIn];
    const to: Point = outAcross ? [cx + Math.sign(nx - cx) * cutOut, cy] : [cx, cy + Math.sign(ny - cy) * cutOut];
    const fromDistance = at[i] - (at[i] - at[i - 1]) * (cutIn / inLength);
    const toDistance = at[i] + (at[i + 1] - at[i]) * (cutOut / outLength);
    for (let k = 0; k <= PIECES; k += 1) {
      const t = k / PIECES;
      const u = 1 - t;
      points.push([u * u * from[0] + 2 * u * t * cx + t * t * to[0], u * u * from[1] + 2 * u * t * cy + t * t * to[1]]);
      distances.push(fromDistance + (toDistance - fromDistance) * t);
    }
  }
  points.push(source[source.length - 1]);
  distances.push(at[at.length - 1]);
  return { ...route, points, distances };
}
