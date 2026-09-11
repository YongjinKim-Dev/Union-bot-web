"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrawEntry, Ladder } from "@/lib/draw";
import { traceLadder } from "@/lib/draw";
import styles from "./draw.module.css";

/* 다 같이 보는 화면이라 크기를 밖에서 정한다. */
export interface LadderScale {
  columnWidth: number;
  rowHeight: number;
  nameSize: number;
}
export const STAGE_SCALE: LadderScale = { columnWidth: 64, rowHeight: 20, nameSize: 12 };
export const COMPACT_SCALE: LadderScale = { columnWidth: 46, rowHeight: 16, nameSize: 9 };

/*
 * 라운드가 넘어갈수록 사람이 줄어 사다리가 홀쭉해진다. 다 같이 보는 화면인데
 * 결승이 제일 작으면 김이 샌다. 남은 사람 수에 맞춰 키운다.
 */
export function scaleFor(columns: number): LadderScale {
  if (columns <= 3) return { columnWidth: 168, rowHeight: 38, nameSize: 22 };
  if (columns <= 5) return { columnWidth: 130, rowHeight: 32, nameSize: 18 };
  if (columns <= 8) return { columnWidth: 96, rowHeight: 26, nameSize: 15 };
  return STAGE_SCALE;
}
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
  winningSlots,
  revealed,
  running,
  onFinish,
  scale = COMPACT_SCALE,
  durationMs = 2200,
}: {
  ladder: Ladder;
  /** 출발 순서(이름순)대로 늘어놓은 참여자. */
  entries: DrawEntry[];
  /** 당첨이 걸린 도착 자리. 스타트 전에는 그리지 않는다. */
  winningSlots: number[];
  /** 길이 다 내려온 뒤에만 당첨을 드러낸다. */
  revealed: boolean;
  running: boolean;
  onFinish: () => void;
  scale?: LadderScale;
  durationMs?: number;
}) {
  const COLUMN_WIDTH = scale.columnWidth;
  const ROW_HEIGHT = scale.rowHeight;
  const x = (column: number) => column * COLUMN_WIDTH + COLUMN_WIDTH / 2;
  /* 스타트 전에는 길을 그리지 않는다 — 미리 눈으로 좇을 거리를 주지 않는다. */
  const [progress, setProgress] = useState(0);

  /*
   * 진행값은 처음 값으로만 정한다(위 useState). 효과 안에서 곧바로 setState 하면
   * 그린 것을 지우고 다시 그리는 셈이라, 새 추첨마다 이 컴포넌트를 통째로 다시
   * 세운다 — 부르는 쪽이 key 를 바꾼다.
   */
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const span = durationMs;
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
  }, [running, onFinish, durationMs]);

  const width = ladder.columns * COLUMN_WIDTH;
  const height = TOP + (ladder.rows + 1) * ROW_HEIGHT + TOP;
  /* land[출발 열] = 도착 자리. */
  const land = useMemo(() => traceLadder(ladder), [ladder]);
  const won = useMemo(() => new Set(winningSlots), [winningSlots]);
  const didWin = (column: number) => revealed && won.has(land[column]);

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
    // x 는 COLUMN_WIDTH 에서만 나오므로 그것만 따르면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, COLUMN_WIDTH, ROW_HEIGHT]);

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
        {paths.map((points, start) => (
          <polyline key={`p${start}`} points={points}
            className={`${styles.ladderPath} ${didWin(start) ? styles.ladderPathWin : ""}`}
            style={{ strokeDasharray: 4000, strokeDashoffset: 4000 * (1 - progress) }} />
        ))}
        {/* 당첨이 걸린 자리. 길이 다 내려온 뒤에 드러난다. */}
        {revealed && winningSlots.map((slot) => (
          <circle key={`w${slot}`} cx={x(slot)} cy={height - TOP} r={Math.max(4, scale.nameSize / 3)}
            className={styles.ladderSlot} />
        ))}
      </svg>
      <div className={styles.ladderLabels} style={{ width, height: Math.round(scale.nameSize * 2.8) }}>
        {entries.map((entry, i) => (
          <span key={entry.nickname} className={styles.ladderName}
            style={{ left: x(i), width: COLUMN_WIDTH, fontSize: scale.nameSize }}
            data-won={didWin(i) ? "true" : undefined}>
            {entry.nickname}
          </span>
        ))}
      </div>
    </div>
  );
}

