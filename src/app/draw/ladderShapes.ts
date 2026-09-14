import type { Ladder, LadderLoop, LadderRoute, LadderRung } from "@/lib/draw";

/*
 * 사다리를 그리는 모양. 좌표는 칸 단위이고(세로줄 가운데가 x = 열 + 0.5, 가로줄이 앉는
 * 높이가 y = 줄 + 1.5), 누가 어디에 닿는지는 엔진이 정한 대로다. 여기서는 선을 어떻게
 * 긋고 사람이 그 선을 어떻게 따라가는지만 정한다.
 */

type Point = [number, number];

/* 휘는 가로줄이 아래로 처지는 깊이와 물결 높이(줄), 반원이 옆으로 부푸는 폭(칸). */
const CURVE_SAG = 1.4;
const WAVE_HEIGHT = 1.0;
const LOOP_WIDTH = 0.32;
const PIECES = 12;

const join = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

/** 가로줄 왼쪽 끝에서 t(0~1)만큼 간 곳이 곧은 선에서 아래로 얼마나 벗어나는지. */
function bend(rung: LadderRung, t: number): number {
  if (rung.shape === "curve") return CURVE_SAG * 4 * t * (1 - t);
  if (rung.shape === "wave") return WAVE_HEIGHT * Math.sin(2 * Math.PI * t);
  return 0;
}

/** 가로줄의 점들. 곧거나 비스듬하면 두 점, 휘거나 출렁이면 곡선 위의 여러 점. */
export function rungPoints(rung: LadderRung): string {
  const y0 = rung.row + 1.5;
  const y1 = rung.rightRow + 1.5;
  if (rung.shape === "straight" || y0 !== y1) return join([[rung.left + 0.5, y0], [rung.left + 1.5, y1]]);
  return join(Array.from({ length: PIECES + 1 }, (_, k): Point => [rung.left + 0.5 + k / PIECES, y0 + bend(rung, k / PIECES)]));
}

/** 반원 위에서 t(0~1)만큼 돈 곳. 위 끝에서 출발해 옆으로 부풀었다가 아래 끝으로 돌아온다. */
function loopAt(loop: LadderLoop, t: number): Point {
  const top = loop.from + 1.5;
  const bottom = loop.to + 1.5;
  const angle = Math.PI * t;
  return [loop.column + 0.5 + loop.side * LOOP_WIDTH * Math.sin(angle), top + ((bottom - top) * (1 - Math.cos(angle))) / 2];
}

export function loopPoints(loop: LadderLoop): string {
  return join(Array.from({ length: PIECES * 2 + 1 }, (_, k) => loopAt(loop, k / (PIECES * 2))));
}

/** 세로줄을 그을 토막들. 반원이 있는 높이는 비워 둔다 — 그 사이는 반원으로 돌아간다. */
export function verticalSegments(ladder: Ladder, column: number): [number, number][] {
  const segments: [number, number][] = [];
  let top = 0.5;
  for (const loop of ladder.loops.filter((l) => l.column === column).sort((a, b) => a.from - b.from)) {
    segments.push([top, loop.from + 1.5]);
    top = loop.to + 1.5;
  }
  segments.push([top, ladder.rows + 1.5]);
  return segments;
}

/*
 * 사람이 걷는 길을 그림에 맞춰 다시 짠다. 휘는 가로줄은 곡선을 따라 건너고, 반원이 있는
 * 세로줄은 반원을 따라 돈다.
 *
 * 새로 넣는 점마다 원래 구간의 거리를 나눠 준다. 선이 조금 길어져도 걷는 시간은 곧은
 * 길과 같고, 누가 먼저 닿는지도 바뀌지 않는다.
 */
export function drawnRoute(route: LadderRoute, ladder: Ladder): LadderRoute {
  const rungAt = new Map(ladder.rungs.map((rung) => [`${rung.left}:${rung.row}`, rung]));
  const points: Point[] = [route.points[0]];
  const distances = [route.distances[0]];
  for (let i = 1; i < route.points.length; i += 1) {
    const [x0, y0] = route.points[i - 1];
    const [x1, y1] = route.points[i];
    const d0 = route.distances[i - 1];
    const d1 = route.distances[i];
    if (x0 === x1 && y1 > y0) {
      // 세로로 내려가는 구간. 그 사이에 반원이 있으면 돌아간다.
      const column = x0 - 0.5;
      const loops = ladder.loops.filter((l) => l.column === column && l.from + 1.5 > y0 && l.to + 1.5 < y1)
        .sort((a, b) => a.from - b.from);
      for (const loop of loops) {
        for (let k = 0; k <= PIECES * 2; k += 1) {
          const point = loopAt(loop, k / (PIECES * 2));
          points.push(point);
          distances.push(d0 + ((d1 - d0) * (point[1] - y0)) / (y1 - y0));
        }
      }
    } else if (x0 !== x1 && y0 === y1) {
      // 높이가 같은 가로줄로 건너가는 구간. 휘거나 출렁이면 그 곡선을 따른다.
      const left = Math.min(x0, x1) - 0.5;
      const rung = rungAt.get(`${left}:${y0 - 1.5}`);
      if (rung && rung.shape !== "straight") {
        for (let k = 1; k < PIECES; k += 1) {
          const x = x0 + ((x1 - x0) * k) / PIECES;
          points.push([x, y0 + bend(rung, x - (left + 0.5))]);
          distances.push(d0 + ((d1 - d0) * k) / PIECES);
        }
      }
    }
    points.push([x1, y1]);
    distances.push(d1);
  }
  return { ...route, points, distances };
}
