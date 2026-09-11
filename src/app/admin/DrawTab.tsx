"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { DrawRow } from "@/lib/drawQueries";
import { formatKstDateTime } from "@/lib/format";
import styles from "./admin.module.css";
import { fetchDrawEntriesAction, fetchDrawsAction } from "./drawActions";

/*
 * 추첨 자체는 따로 띄우는 화면(/draw)에서 한다. 다 같이 보는 자리라 탭·사이드바
 * 같은 관리자 화면 요소가 없어야 하고, 화면 공유나 프로젝터에 그대로 올릴 수
 * 있어야 한다. 여기는 열어 주는 자리와 지난 기록만 둔다.
 */
export function DrawTab() {
  const [history, setHistory] = useState<DrawRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ nickname: string; isWinner: boolean }[]>([]);
  const [isBusy, startBusy] = useTransition();

  const load = useCallback(() => {
    startBusy(async () => {
      try { setHistory(await fetchDrawsAction()); } catch { /* 다시 열면 회복된다 */ }
    });
  }, []);
  useEffect(load, [load]);

  async function toggle(id: string) {
    if (openId === id) return setOpenId(null);
    setEntries((await fetchDrawEntriesAction(id)).map((r) => ({ nickname: r.nickname, isWinner: r.isWinner })));
    setOpenId(id);
  }

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>추첨</h2>
      <p className={styles.hint}>
        정원이 넘쳐 남은 자리를 나눌 때 씁니다. 추첨 창을 열어 참여자를 넣고 시작하세요.
        씨앗을 먼저 디스코드에 올린 뒤 뽑으면, 나중에 누구든 같은 씨앗으로 같은 결과가 나오는지 확인할 수 있습니다.
        참여자가 12명을 넘으면 조로 나눠 라운드를 치르지만, 확률은 전체를 한 번에 섞어 정하므로 조 배정으로 유불리가 생기지 않습니다.
      </p>

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>다 같이 보는 화면으로 열립니다</span>
          <span className={styles.spacer} />
          <a className={`${styles.btnSm} ${styles.btnPrimary}`} href="/draw" target="_blank" rel="noreferrer">
            추첨 창 열기 ↗
          </a>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>지난 추첨 {history.length}건</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={load} disabled={isBusy}>새로 고침</button>
        </div>
        {!history.length && <p className={styles.hint}>아직 남긴 추첨이 없습니다.</p>}
        <ol className={styles.specList}>
          {history.map((row) => (
            <li key={row.id} className={openId === row.id ? styles.specOpen : undefined}>
              <button type="button" className={styles.drawRow} onClick={() => toggle(row.id)}
                aria-expanded={openId === row.id}>
                <span className={styles.specName}><span className={styles.specNick}>{row.title}</span></span>
                <span className={`${styles.specParts} ${styles.mono}`}>{row.entryCount}명 중 {row.pickCount}명</span>
                <span className={`${styles.specParts} ${styles.mono}`}>씨앗 {row.seed}</span>
                <span className={`${styles.specTime} ${styles.mono}`}>{formatKstDateTime(new Date(row.createdAt))}</span>
                <span className={styles.specChevron} aria-hidden="true">{openId === row.id ? "▴" : "▾"}</span>
              </button>
              {openId === row.id && (
                <div className={styles.specPanel}>
                  <ul className={styles.pickedList}>
                    {entries.map((e) => (
                      <li key={e.nickname} className={`${styles.pickedChip} ${e.isWinner ? styles.pickedWon : ""}`}>
                        <span>{e.nickname}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
