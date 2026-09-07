"use client";

import { useEffect, useState, useTransition } from "react";
import { formatKstTimeWithSeconds, formatSurveyDate } from "@/lib/format";
import type { VoteFailureRow } from "@/lib/voteLog";
import { VOTING_TYPE_LABEL } from "@/lib/types";
import styles from "./admin.module.css";
import { fetchVoteFailures } from "./pastActions";

const REASON_LABEL: Record<string, string> = {
  closed: "마감·미오픈",
  auth: "로그인 풀림",
};

/*
 * 거절된 투표만 모아 본다. 성공한 표는 survey_history 에 도착 시각까지 남으므로
 * 여기에는 "왜 안 됐는지" 만 쌓인다. 마감 직전에 몰려 거절된 것인지, 특정 기기에서만
 * 실패하는지 같은 것을 보라고 만든 화면이다.
 */
export function FailureLogTab() {
  const [rows, setRows] = useState<VoteFailureRow[]>([]);
  const [total, setTotal] = useState(0);
  const [onlyMobile, setOnlyMobile] = useState(false);
  const [isLoading, startLoad] = useTransition();

  const load = () => {
    startLoad(async () => {
      try {
        const r = await fetchVoteFailures();
        setRows(r.rows);
        setTotal(r.total);
      } catch {
        // 다시 열면 회복된다
      }
    });
  };
  useEffect(load, []);

  const shown = onlyMobile ? rows.filter((r) => r.isMobile) : rows;
  const mobileCount = rows.filter((r) => r.isMobile).length;

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>거절된 투표 기록</h2>
      <p className={styles.hint}>
        성공한 표는 지난 투표에서 보고, 여기에는 처리되지 못한 요청만 쌓입니다. 최근 100건.
      </p>

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>
            전체 {total}건 · 표시 {shown.length}건 · 모바일 {mobileCount}건
          </span>
          <span className={styles.spacer} />
          <button
            type="button"
            className={`${styles.btnSm} ${onlyMobile ? styles.btnPrimary : ""}`}
            onClick={() => setOnlyMobile((v) => !v)}
          >
            {onlyMobile ? "전체 보기" : "모바일만"}
          </button>
          <button type="button" className={styles.btnSm} onClick={load} disabled={isLoading}>
            {isLoading ? "새로 고치는 중..." : "새로 고침"}
          </button>
        </div>

        {shown.length === 0 && (
          <p className={styles.hint}>거절된 투표가 없습니다. 정상입니다.</p>
        )}

        {shown.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.diffTable}>
              <thead>
                <tr>
                  <th>도착 시각</th>
                  <th>회차</th>
                  <th>닉네임</th>
                  <th>시도</th>
                  <th>기기</th>
                  <th>사유</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.mono}>
                      {formatSurveyDate(new Date(r.arrivedAt)).slice(5, 10)}{" "}
                      {formatKstTimeWithSeconds(new Date(r.arrivedAt))}
                    </td>
                    <td className={styles.mono}>{r.surveyId ?? "—"}</td>
                    <td>{r.nickname ?? "—"}</td>
                    <td>{VOTING_TYPE_LABEL[r.votingType] ?? r.votingType}</td>
                    <td>
                      <span
                        className={`${styles.diffBadge} ${r.isMobile ? styles.diffAdded : styles.diffKept}`}
                      >
                        {r.isMobile ? "모바일" : "PC"} · {r.platform}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.diffBadge} ${styles.diffRemoved}`}>
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </span>
                    </td>
                    <td className={styles.mono}>{r.elapsedMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
