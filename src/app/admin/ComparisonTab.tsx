"use client";

import { useEffect, useState, useTransition } from "react";
import { formatKstTimeWithSeconds, formatSurveyDate, formatSurveyTime } from "@/lib/format";
import type { PastSurveyRow, RosterDiffRow } from "@/lib/adminQueries";
import { VOTING_TYPE_LABEL } from "@/lib/types";
import styles from "./admin.module.css";
import { fetchComparableSurveys, fetchRosterComparison } from "./pastActions";

/*
 * 원본(사람들이 실제로 누른 표)과 확정 명단을 회차별로 나란히 본다.
 * 원본은 어떤 경우에도 바뀌지 않으므로, 여기가 "무엇이 조정됐나"의 근거가 된다.
 */
export function ComparisonTab() {
  const [rows, setRows] = useState<PastSurveyRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [openSurvey, setOpenSurvey] = useState<PastSurveyRow | null>(null);
  const [diff, setDiff] = useState<RosterDiffRow[]>([]);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [isLoading, startLoad] = useTransition();

  useEffect(() => {
    fetchComparableSurveys(page)
      .then((r) => {
        setRows(r.rows);
        setTotal(r.total);
        setPageSize(r.pageSize);
      })
      .catch(() => {
        // 일시적인 실패는 탭을 다시 열면 회복된다
      });
  }, [page]);

  function open(row: PastSurveyRow) {
    startLoad(async () => {
      try {
        setDiff(await fetchRosterComparison(row.id));
        setOpenSurvey(row);
      } catch {
        // 조회 실패 시 목록에 그대로 남는다
      }
    });
  }

  if (!openSurvey) {
    return (
      <section className={styles.opStack}>
        <h2 className={styles.rosterTitle}>원본 · 확정 명단 비교</h2>
        <p className={styles.hint}>
          회차를 고르면 사람들이 실제로 누른 표와 관리자가 확정한 명단을 나란히 볼 수 있습니다.
        </p>
        <div className={styles.card}>
          <div className={styles.surveyList}>
            {rows.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.sRow}
                disabled={isLoading}
                onClick={() => open(s)}
              >
                <span className={styles.sCol}>
                  <span className={styles.sTitle}>
                    {formatSurveyDate(s.executed_at)} {formatSurveyTime(s.executed_at)} 거점전
                  </span>
                  <span className={styles.sSub}>
                    참여 {s.counts["참여"] + s.counts["부속"]} · 늦참 {s.counts["늦참"]} · 미참{" "}
                    {s.counts["미참"]}
                  </span>
                </span>
                <span className={styles.sLink}>비교 보기</span>
              </button>
            ))}
            {rows.length === 0 && (
              <div className={styles.qEmpty}>아직 확정된 명단이 있는 회차가 없습니다</div>
            )}
          </div>
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pBtn}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              ‹
            </button>
            <span className={styles.pGap}>
              {page} / {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              type="button"
              className={styles.pBtn}
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    );
  }

  const changed = diff.filter((d) => d.status !== "유지");
  const original = diff
    .filter((d) => d.originalRank !== null)
    .sort((a, b) => (a.originalRank ?? 0) - (b.originalRank ?? 0));
  const final = diff
    .filter((d) => d.finalRank !== null)
    .sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0));

  /* 위로 올라갔으면 ↑, 내려갔으면 ↓. 원본에 없던 사람은 표시하지 않는다. */
  function delta(d: RosterDiffRow) {
    if (d.originalRank === null || d.finalRank === null) return null;
    const moved = d.originalRank - d.finalRank;
    if (moved === 0) return null;
    return moved > 0 ? `↑${moved}` : `↓${-moved}`;
  }

  function row(d: RosterDiffRow, side: "original" | "final") {
    const removed = side === "original" && d.status === "뺌";
    const added = side === "final" && d.status === "추가";
    const moved = side === "final" ? delta(d) : null;
    if (onlyChanged && d.status === "유지") return null;
    return (
      <div key={d.nickname} className={`${styles.cmpRow} ${removed ? styles.cmpRemoved : ""}`}>
        <span className={`${styles.cmpRank} ${styles.mono}`}>
          {side === "original" ? d.originalRank : d.finalRank}
        </span>
        <span className={styles.cmpNick}>{d.nickname}</span>
        <span className={styles.cmpJob}>{d.className ?? "-"}</span>
        <span className={styles.cmpVote}>
          {d.votingType ? VOTING_TYPE_LABEL[d.votingType] : "-"}
          {side === "original" && d.votedAt && (
            <span className={styles.cmpTime}>
              {formatKstTimeWithSeconds(new Date(d.votedAt))}
            </span>
          )}
        </span>
        <span className={styles.cmpMark}>
          {removed && <span className={`${styles.diffBadge} ${styles.diffRemoved}`}>뺌</span>}
          {added && <span className={`${styles.diffBadge} ${styles.diffAdded}`}>추가</span>}
          {moved && <span className={`${styles.diffBadge} ${styles.diffMoved}`}>{moved}</span>}
        </span>
      </div>
    );
  }

  return (
    <section className={styles.opStack}>
      <div className={styles.titleRow}>
        <button type="button" className={styles.btnSm} onClick={() => setOpenSurvey(null)}>
          ← 목록
        </button>
        <h2 className={styles.rosterTitle}>
          {formatSurveyDate(openSurvey.executed_at)} 거점전
        </h2>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.btnSm} ${onlyChanged ? styles.btnPrimary : ""}`}
          onClick={() => setOnlyChanged((v) => !v)}
        >
          {onlyChanged ? "전체 보기" : "변경된 것만"}
        </button>
      </div>

      {changed.length === 0 ? (
        <p className={styles.hint}>이 회차는 조정 없이 원본 그대로 확정되었습니다.</p>
      ) : (
        <p className={styles.hint}>
          변경 {changed.length}건 · 뺌 {changed.filter((d) => d.status === "뺌").length} · 추가{" "}
          {changed.filter((d) => d.status === "추가").length} · 순번 변경{" "}
          {changed.filter((d) => d.status === "순번 변경").length}
        </p>
      )}

      <div className={styles.cmpGrid}>
        <div className={styles.card}>
          <div className={styles.cmpHead}>
            <h3 className={styles.cardTitle}>원본 · 투표순</h3>
            <span className={styles.label}>{original.length}명</span>
          </div>
          <p className={styles.cmpNote}>사람들이 실제로 누른 표입니다. 바뀌지 않습니다.</p>
          <div className={styles.cmpList}>{original.map((d) => row(d, "original"))}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cmpHead}>
            <h3 className={styles.cardTitle}>확정 명단</h3>
            <span className={styles.label}>{final.length}명</span>
          </div>
          <p className={styles.cmpNote}>관리자가 확정한 순번입니다.</p>
          <div className={styles.cmpList}>{final.map((d) => row(d, "final"))}</div>
        </div>
      </div>
    </section>
  );
}
