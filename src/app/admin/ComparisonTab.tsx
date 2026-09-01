"use client";

import { useEffect, useState, useTransition } from "react";
import { formatKstTimeWithSeconds, formatSurveyDate, formatSurveyTime } from "@/lib/format";
import type { PastSurveyRow, RosterDiffRow } from "@/lib/adminQueries";
import { VOTING_TYPE_LABEL } from "@/lib/types";
import styles from "./admin.module.css";
import { fetchPastSurveys, fetchRosterComparison } from "./pastActions";

/*
 * 원본(사람들이 실제로 누른 표)과 확정 명단을 회차별로 나란히 본다.
 * 원본은 어떤 경우에도 바뀌지 않으므로, 여기가 "무엇이 조정됐나"의 근거가 된다.
 */
export function ComparisonTab() {
  const [rows, setRows] = useState<PastSurveyRow[]>([]);
  const [openSurvey, setOpenSurvey] = useState<PastSurveyRow | null>(null);
  const [diff, setDiff] = useState<RosterDiffRow[]>([]);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [isLoading, startLoad] = useTransition();

  useEffect(() => {
    fetchPastSurveys(1)
      .then((r) => setRows(r.rows))
      .catch(() => {
        // 일시적인 실패는 탭을 다시 열면 회복된다
      });
  }, []);

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
            {rows.length === 0 && <div className={styles.qEmpty}>지난 회차가 아직 없습니다</div>}
          </div>
        </div>
      </section>
    );
  }

  const changed = diff.filter((d) => d.status !== "유지");
  const shown = onlyChanged ? changed : diff;

  return (
    <section className={styles.opStack}>
      <div className={styles.titleRow}>
        <button type="button" className={styles.btnSm} onClick={() => setOpenSurvey(null)}>
          ← 목록
        </button>
        <h2 className={styles.rosterTitle}>
          {formatSurveyDate(openSurvey.executed_at)} 거점전 · 원본 대비 확정 명단
        </h2>
      </div>

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>
            원본 {diff.filter((d) => d.originalRank !== null).length}명 · 확정{" "}
            {diff.filter((d) => d.finalRank !== null).length}명 · 변경 {changed.length}건
          </span>
          <span className={styles.spacer} />
          <button
            type="button"
            className={`${styles.btnSm} ${onlyChanged ? styles.btnPrimary : ""}`}
            onClick={() => setOnlyChanged((v) => !v)}
          >
            {onlyChanged ? "전체 보기" : "변경된 것만"}
          </button>
        </div>

        {changed.length === 0 && (
          <p className={styles.hint}>이 회차는 조정 없이 원본 그대로 확정되었습니다.</p>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.diffTable}>
            <thead>
              <tr>
                <th>원본 순번</th>
                <th>확정 순번</th>
                <th>닉네임</th>
                <th>직업</th>
                <th>표</th>
                <th>투표 시각</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.nickname} className={d.status === "유지" ? "" : styles.diffRowChanged}>
                  <td className={styles.mono}>{d.originalRank ?? "—"}</td>
                  <td className={styles.mono}>{d.finalRank ?? "—"}</td>
                  <td>{d.nickname}</td>
                  <td>{d.className ?? "-"}</td>
                  <td>{d.votingType ? VOTING_TYPE_LABEL[d.votingType] : "-"}</td>
                  <td className={styles.mono}>
                    {d.votedAt ? formatKstTimeWithSeconds(new Date(d.votedAt)) : "-"}
                  </td>
                  <td>
                    <span className={`${styles.diffBadge} ${styles[`diff${d.status === "뺌" ? "Removed" : d.status === "추가" ? "Added" : d.status === "순번 변경" ? "Moved" : "Kept"}`]}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
