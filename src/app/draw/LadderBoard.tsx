"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { DrawEntry, Ladder, LadderRoute } from "@/lib/draw";
import { routesOf, traceLadder } from "@/lib/draw";
import { type LadderVariant, drawnRoute, rungPoints } from "./ladderStyle";
import styles from "./draw.module.css";

/* 가로줄 한 줄이나 옆 칸 하나를 지나는 시간. 모든 조가 같은 빠르기로 걷는다. */
const MS_PER_STEP = 320;

/** 걸어온 거리만큼의 길과, 지금 서 있는 자리. */
function walk(route: LadderRoute, distance: number): { trail: string; head: [number, number] } {
  const { points, distances, total } = route;
  if (distance >= total) {
    return { trail: points.map(([x, y]) => `${x},${y}`).join(" "), head: points[points.length - 1] };
  }
  let k = 0;
  while (distances[k + 1] <= distance) k += 1;
  const [x0, y0] = points[k];
  const [x1, y1] = points[k + 1];
  const t = (distance - distances[k]) / (distances[k + 1] - distances[k]);
  const head: [number, number] = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  return { trail: [...points.slice(0, k + 1), head].map(([x, y]) => `${x},${y}`).join(" "), head };
}

/*
 * 사다리를 그리고 사람마다 자기 길을 따라 걸어 내려간다.
 *
 * 길은 실제로 결과에 닿는 길이다. 손가락으로 따라가면 발표한 자리에 도착한다.
 * 그림과 결과가 따로 놀면 그건 추첨이 아니라 연출이다.
 *
 * 당첨 자리는 처음부터 보여 주고, 대신 시작 전에는 가로줄을 가려 둔다. 사다리 게임을
 * 종이에 할 때 아래 상품은 적어 두고 가운데를 접어 가리는 것과 같다. 둘 다 보이면
 * 길을 눈으로 따라가 원하는 사람을 당첨 자리로 옮길 수 있기 때문이다.
 *
 * 모두 같은 빠르기로 걷기 때문에 건너는 가로줄이 적은 사람이 먼저 닿는다. 닿는
 * 순간 그 사람과 도착 칸에 불이 들어온다 — 결과는 한꺼번에가 아니라 한 명씩 나온다.
 *
 * 크기는 칸으로만 그리고 실제 픽셀은 CSS 에 맡긴다. 가로세로 비율을 맞추지
 * 않으므로(preserveAspectRatio="none") 선 굵기는 vector-effect 로 붙잡고, 원이
 * 찌그러지지 않게 걷는 점과 결과 칸은 그림 위에 HTML 로 얹는다.
 */
export function LadderBoard({
  ladder,
  entries,
  winningSlots,
  revealed,
  running,
  onFinish,
  winLabel = "당첨",
  faces,
  covered = false,
  variant = "straight",
}: {
  ladder: Ladder;
  /** 출발 순서대로 늘어놓은 참여자. */
  entries: DrawEntry[];
  /** 당첨이 걸린 도착 자리. 처음부터 보여 준다. */
  winningSlots: number[];
  /** 모두 드러낸다. 걷기가 끝난 뒤 부르는 쪽이 켠다. */
  revealed: boolean;
  running: boolean;
  onFinish: () => void;
  /** 뽑힌 자리에 붙일 말. 결승이 아니면 "진출". */
  winLabel?: string;
  /** 닉네임별 프로필 사진. 없으면 점으로 걷는다. */
  faces?: ReadonlyMap<string, string>;
  /** 가로줄을 가린다. 자리를 바꾸는 동안 켠다. */
  covered?: boolean;
  /** 선을 긋는 모양. 결과와 상관없다. */
  variant?: LadderVariant;
}) {
  const routes = useMemo(() => routesOf(ladder), [ladder]);
  /* 걷는 모습은 변형에 맞춘 길을 따른다. 거리와 도착 시각은 원래 길과 같다. */
  const drawn = useMemo(() => routes.map((route) => drawnRoute(route, variant)), [routes, variant]);
  const span = useMemo(() => Math.max(...routes.map((r) => r.total)) * MS_PER_STEP, [routes]);
  /* 스타트 전에는 길을 그리지 않는다 — 미리 눈으로 좇을 거리를 주지 않는다. */
  const [elapsed, setElapsed] = useState(0);

  /*
   * 걸은 시간은 처음 값으로만 정한다(위 useState). 새 라운드마다 이 컴포넌트를
   * 통째로 다시 세운다 — 부르는 쪽이 key 를 바꾼다.
   */
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setElapsed(span);
      onFinish();
    };
    const step = (now: number) => {
      const value = Math.min(span, now - started);
      setElapsed(value);
      if (value < span) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    /*
     * 화면이 뒤로 가면 브라우저가 프레임을 멈춘다. 그 사이 추첨이 끝나지 않은
     * 채로 남으면 결과를 영영 볼 수 없으므로, 시간이 지나면 프레임과 상관없이
     * 끝낸다. 돌아왔을 때 결과가 나와 있는 편이 멈춰 있는 것보다 낫다.
     */
    const timer = setTimeout(finish, span + 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [running, onFinish, span]);

  const distance = elapsed / MS_PER_STEP;
  const x = (column: number) => column + 0.5;
  const y = (row: number) => row + 0.5;
  const bottom = y(ladder.rows + 1);
  const pctX = (value: number) => `${(value / ladder.columns) * 100}%`;
  const pctY = (value: number) => `${(value / (ladder.rows + 2)) * 100}%`;

  /* 결과는 엔진의 계산을 따른다. 그림의 도착 자리는 같아야 하고, 다르면 그림이 틀린 것이다. */
  const land = useMemo(() => traceLadder(ladder), [ladder]);
  const startOf = useMemo(() => {
    const inverse: number[] = [];
    land.forEach((slot, column) => { inverse[slot] = column; });
    return inverse;
  }, [land]);
  const won = useMemo(() => new Set(winningSlots), [winningSlots]);
  const arrived = (column: number) => revealed || (distance > 0 && distance >= routes[column].total);
  const resultOf = (column: number) => (arrived(column) ? (won.has(land[column]) ? "win" : "lose") : undefined);
  const walks = drawn.map((route) => walk(route, distance));

  return (
    <div className={styles.ladderWrap}>
      {/* 사람이 적으면 열 간격이 터무니없이 벌어져 한 사다리로 안 보인다. 너비를 묶는다. */}
      <div className={styles.ladderInner} style={{ "--columns": ladder.columns } as React.CSSProperties}>
        <div className={styles.ladderLabels}>
          {entries.map((entry, i) => (
            <span key={entry.nickname} className={styles.ladderName} style={{ left: pctX(x(i)) }}
              data-result={resultOf(i)}>
              {entry.nickname}
            </span>
          ))}
        </div>

        <div className={styles.ladderCanvas}>
          <svg className={styles.ladder} viewBox={`0 0 ${ladder.columns} ${ladder.rows + 2}`}
            preserveAspectRatio="none" role="img" aria-label={`참여자 ${ladder.columns}명의 사다리`}>
            {Array.from({ length: ladder.columns }, (_, i) => (
              <line key={`v${i}`} x1={x(i)} y1={0.5} x2={x(i)} y2={bottom}
                className={styles.ladderLine} vectorEffect="non-scaling-stroke" />
            ))}
            {!covered && ladder.rungs.map((rung) => {
              const curved = rungPoints(variant, rung.left, y(rung.row + 1));
              return curved ? (
                <polyline key={`r${rung.row}-${rung.left}`} points={curved}
                  className={styles.ladderLine} vectorEffect="non-scaling-stroke" />
              ) : (
                <line key={`r${rung.row}-${rung.left}`}
                  x1={x(rung.left)} y1={y(rung.row + 1)} x2={x(rung.left + 1)} y2={y(rung.row + 1)}
                  className={styles.ladderLine} vectorEffect="non-scaling-stroke" />
              );
            })}
            {/* 떨어진 길을 먼저, 뽑힌 길을 나중에 그려 겹친 곳에서 금색이 위로 온다. */}
            {distance > 0 && walks
              .map((w, column) => ({ w, column, result: resultOf(column) }))
              .sort((a, b) => Number(a.result === "win") - Number(b.result === "win"))
              .map(({ w, column, result }) => (
                <polyline key={`p${column}`} points={w.trail} vectorEffect="non-scaling-stroke"
                  className={`${styles.ladderPath} ${result === "win" ? styles.ladderPathWin : result === "lose" ? styles.ladderPathLose : ""}`} />
              ))}
          </svg>
          {/*
            * 사람마다 프로필 사진이 자기 길을 따라 걷는다. 스타트 전에는 자기 줄 맨 위에
            * 서 있어 누가 어디 섰는지 보이고, 닿은 뒤에는 도착 칸 바로 위에 남는다.
            */}
          {covered && (
            <div className={styles.ladderCover} aria-hidden="true">
              <span>시작하면 가로줄이 나타나요</span>
            </div>
          )}
          {walks.map((w, column) => {
            const face = faces?.get(entries[column]?.nickname ?? "");
            return (
              <span key={`h${column}`} className={styles.walker} data-result={resultOf(column)}
                data-face={face ? undefined : "none"} style={{ left: pctX(w.head[0]), top: pctY(w.head[1]) }}>
                {face && <Image src={face} alt="" width={48} height={48} className={styles.walkerFace} unoptimized />}
              </span>
            );
          })}
        </div>

        {/* 도착 자리. 당첨·꽝 은 처음부터 적혀 있고, 누가 닿으면 채워진다. */}
        <div className={styles.slotRow}>
          {Array.from({ length: ladder.columns }, (_, slot) => (
            <span key={`s${slot}`} className={styles.slotCard} style={{ left: pctX(x(slot)) }}
              data-win={won.has(slot) ? "true" : undefined}
              data-arrived={arrived(startOf[slot]) ? "true" : undefined}>
              {won.has(slot) ? winLabel : "꽝"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
