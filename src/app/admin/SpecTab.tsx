"use client";

import { useEffect, useState, useTransition } from "react";
import { formatKstDateTime } from "@/lib/format";
import { SpecViewer } from "@/app/equipment/SpecViewer";
import type { SpecSubmissionListRow } from "@/lib/specQueries";
import styles from "./admin.module.css";
import { fetchSpecSubmissions, type SpecSurveyView } from "./specActions";

/*
 * 낸 스펙을 공방합 순으로 본다. 행을 누르면 그 사람이 낸 세팅이 펼쳐지는데,
 * 연맹원이 쓰는 화면과 같은 판이고 고르는 기능만 없다. 낸 값은 굳어 있으므로
 * 여기서 고칠 것도 없다.
 */
export function SpecTab() {
  const [survey, setSurvey] = useState<SpecSurveyView | null>(null);
  const [rows, setRows] = useState<SpecSubmissionListRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [isLoading, startLoad] = useTransition();

  const load = () => {
    startLoad(async () => {
      try {
        const result = await fetchSpecSubmissions();
        setSurvey(result.survey);
        setRows(result.rows);
      } catch {
        // 다시 열면 회복된다
      }
    });
  };
  useEffect(load, []);

  async function copyList() {
    const text = rows
      .map((row, index) => `${index + 1}. ${row.nickname} · ${row.isComplete ? row.score : "?"} (AP ${row.ap} / AAP ${row.aap} / DP ${row.dp}) · ${row.buildName}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${rows.length}명 명단을 복사했습니다.`);
    } catch {
      setCopied("복사 권한을 확인해 주세요.");
    }
  }

  const unknown = rows.filter((row) => !row.isComplete).length;

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>스펙조사 제출 명단</h2>
      <p className={styles.hint}>
        공방합이 높은 순입니다. 행을 누르면 그 사람이 낸 장비·수정·광명석을 볼 수 있습니다.
        낸 값은 제출한 순간에 굳으므로, 그 뒤에 세팅을 고쳐도 여기 보이는 것은 바뀌지 않습니다.
      </p>

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>
            {survey ? `${survey.title}${survey.open ? "" : " (마감)"} · 제출 ${rows.length}명` : "등록된 스펙조사가 없습니다"}
            {unknown > 0 && ` · 수치 미확인 ${unknown}명`}
          </span>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={copyList} disabled={!rows.length}>
            명단 복사
          </button>
          <button type="button" className={styles.btnSm} onClick={load} disabled={isLoading}>
            {isLoading ? "새로 고치는 중..." : "새로 고침"}
          </button>
        </div>

        {copied && <p className={styles.hint}>{copied}</p>}

        {!rows.length && !isLoading && (
          <p className={styles.hint}>아직 아무도 스펙을 내지 않았습니다.</p>
        )}

        <ol className={styles.specList}>
          {rows.map((row, index) => {
            const open = openId === row.userId;
            return (
              <li key={row.userId} className={open ? styles.specOpen : undefined}>
                <button
                  type="button"
                  className={styles.specRow}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : row.userId)}
                >
                  <span className={`${styles.specRank} ${styles.mono}`}>{index + 1}</span>
                  <span className={styles.specName}>{row.nickname}</span>
                  <span className={styles.specBuild}>{row.buildName}</span>
                  <span className={`${styles.specScore} ${styles.mono}`}>{row.isComplete ? row.score : "—"}</span>
                  <span className={`${styles.specParts} ${styles.mono}`}>
                    AP {row.ap} / AAP {row.aap} / DP {row.dp}
                  </span>
                  <span className={`${styles.specTime} ${styles.mono}`}>{formatKstDateTime(new Date(row.submittedAt))}</span>
                  <span className={styles.specChevron} aria-hidden="true">{open ? "▴" : "▾"}</span>
                </button>
                {open && (
                  <div className={styles.specPanel}>
                    {row.build
                      ? <SpecViewer build={row.build} />
                      : <pre className={styles.specText}>{row.summaryText}</pre>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
