"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawEntry, Ladder } from "@/lib/draw";
import { traceLadder } from "@/lib/draw";
import styles from "./admin.module.css";

const COLUMN_WIDTH = 46;
const ROW_HEIGHT = 16;
const TOP = 12;

/*
 * 사다리를 그리고 각 사람의 길을 따라 내려간다.
 *
 * 길은 실제로 결과에 닿는 길이다. 손가락으로 따라가면 발표한 자리에 도착한다.
 * 그림과 결과가 따로 놀면 그건 추첨이 아니라 연출이다.
 */
export function LadderBoard({
  ladder,
  entries,
  pickCount,
  running,
  onFinish,
}: {
  ladder: Ladder;
  /** 출발 순서(이름순)대로 늘어놓은 참여자. */
  entries: DrawEntry[];
  pickCount: number;
  running: boolean;
  onFinish: () => void;
}) {
  const [progress, setProgress] = useState(running ? 0 : 1);

  /*
   * 진행값은 처음 값으로만 정한다(위 useState). 효과 안에서 곧바로 setState 하면
   * 그린 것을 지우고 다시 그리는 셈이라, 새 추첨마다 이 컴포넌트를 통째로 다시
   * 세운다 — 부르는 쪽이 key 를 바꾼다.
   */
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const span = 2200;
    let raf = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setProgress(1);
      onFinish();
    };
    const step = (now: number) => {
      const value = Math.min(1, (now - started) / span);
      setProgress(value);
      if (value < 1) raf = requestAnimationFrame(step);
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
  }, [running, onFinish]);

  const width = ladder.columns * COLUMN_WIDTH;
  const height = TOP + (ladder.rows + 1) * ROW_HEIGHT + TOP;
  const arrival = useMemo(() => traceLadder(ladder), [ladder]);
  // arrival[자리] = 출발 열. 뒤집으면 "이 사람이 몇 번째 자리에 닿는가" 가 된다.
  const landedAt = useMemo(() => {
    const map = new Array<number>(ladder.columns);
    arrival.forEach((column, position) => { map[column] = position; });
    return map;
  }, [arrival, ladder.columns]);

  const paths = useMemo(() => {
    const rungsByRow = new Map<number, number[]>();
    for (const rung of ladder.rungs) {
      const list = rungsByRow.get(rung.row) ?? [];
      list.push(rung.left);
      rungsByRow.set(rung.row, list);
    }
    return Array.from({ length: ladder.columns }, (_, start) => {
      let column = start;
      const points = [`${x(column)},${TOP}`];
      for (let row = 0; row < ladder.rows; row += 1) {
        const y = TOP + (row + 1) * ROW_HEIGHT;
        const lefts = rungsByRow.get(row) ?? [];
        points.push(`${x(column)},${y}`);
        if (lefts.includes(column)) column += 1;
        else if (lefts.includes(column - 1)) column -= 1;
        points.push(`${x(column)},${y}`);
      }
      points.push(`${x(column)},${TOP + (ladder.rows + 1) * ROW_HEIGHT}`);
      return points.join(" ");
    });
  }, [ladder]);

  return (
    <div className={styles.ladderWrap}>
      <svg className={styles.ladder} width={width} height={height} role="img"
        aria-label={`참여자 ${ladder.columns}명의 사다리`}>
        {/* 세로줄 */}
        {Array.from({ length: ladder.columns }, (_, i) => (
          <line key={`v${i}`} x1={x(i)} y1={TOP} x2={x(i)} y2={height - TOP} className={styles.ladderLine} />
        ))}
        {/* 가로줄 */}
        {ladder.rungs.map((rung) => (
          <line key={`r${rung.row}-${rung.left}`}
            x1={x(rung.left)} y1={TOP + (rung.row + 1) * ROW_HEIGHT}
            x2={x(rung.left + 1)} y2={TOP + (rung.row + 1) * ROW_HEIGHT}
            className={styles.ladderLine} />
        ))}
        {/* 길 — 당첨된 사람만 금색으로 남긴다 */}
        {paths.map((points, start) => {
          const won = landedAt[start] < pickCount;
          return (
            <polyline key={`p${start}`} points={points}
              className={`${styles.ladderPath} ${won ? styles.ladderPathWin : ""}`}
              style={{ strokeDasharray: 4000, strokeDashoffset: 4000 * (1 - progress) }} />
          );
        })}
      </svg>
      <div className={styles.ladderLabels} style={{ width }}>
        {entries.map((entry, i) => (
          <span key={entry.nickname} className={styles.ladderName}
            style={{ left: x(i), width: COLUMN_WIDTH }}
            data-won={progress >= 1 && landedAt[i] < pickCount ? "true" : undefined}>
            {entry.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

function x(column: number): number {
  return column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
}
