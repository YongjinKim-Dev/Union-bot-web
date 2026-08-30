"use client";

import { useEffect, useState, useTransition } from "react";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import type { PastSurveyRow } from "@/lib/adminQueries";
import styles from "./admin.module.css";
import { RosterTable } from "./RosterTable";
import { type Member, VOTES, type Vote, countsOf, ofVote, votersToMembers } from "./adminData";
import { fetchVoters } from "./actions";
import { fetchPastSurveys } from "./pastActions";

const POLL_MS = 5000;

interface PastVotesTabProps {
  cap: number;
}

// 1 … (현재 주변 3칸) … 끝 모양으로 페이지 번호를 줄인다
function pageWindow(cur: number, total: number): (number | "…")[] {
  const start = Math.min(Math.max(cur - 1, 1), Math.max(total - 2, 1));
  const end = Math.min(start + 2, total);
  const out: (number | "…")[] = [];
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || (i >= start && i <= end)) out.push(i);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}

export function PastVotesTab({ cap }: PastVotesTabProps) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PastSurveyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  const [openSurvey, setOpenSurvey] = useState<PastSurveyRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [nonVoterCount, setNonVoterCount] = useState(0);
  const [nonVoterList, setNonVoterList] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Vote | "미투표" | null>(null);
  const [isLoading, startLoad] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchPastSurveys(page)
        .then((r) => {
          if (!alive) return;
          setRows(r.rows);
          setTotal(r.total);
          setPageSize(r.pageSize);
        })
        .catch(() => {
          // 일시적인 실패는 다음 폴링에서 다시 시도한다
        });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const counts = countsOf(members);

  function open(row: PastSurveyRow) {
    startLoad(async () => {
      try {
        const r = await fetchVoters(row.id);
        setMembers(votersToMembers(r.voters));
        setNonVoterCount(r.nonVoters.length);
        setNonVoterList(
          r.nonVoters.map((n, i) => ({
            id: n.nickname,
            nick: n.nickname,
            guild: n.guildName,
            job: "-",
            line: "-",
            vote: "미참" as const,
            ord: i,
            origSeq: i + 1,
            time: "-",
          })),
        );
        setFilter(null);
        setOpenSurvey(row);
      } catch {
        // 조회에 실패하면 목록에 그대로 남는다
      }
    });
  }

  if (!openSurvey) {
    return (
      <section>
        <div className={styles.pastList}>
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
                    참여 {s.counts["참여"] + s.counts["부속"]} · 부속 {s.counts["부속"]} · 늦참 {s.counts["늦참"]} ·
                    미참 {s.counts["미참"]}
                  </span>
                </span>
                <span className={styles.sLink}>투표자 보기</span>
              </button>
            ))}
            {rows.length === 0 && <div className={styles.qEmpty}>지난 회차가 아직 없습니다</div>}
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
            {pageWindow(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className={styles.pGap}>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pBtn} ${p === page ? styles.pOn : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              className={styles.pBtn}
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.opStack}>
      <div className={styles.pastHead}>
        <h2 className={styles.rosterTitle}>{formatSurveyDate(openSurvey.executed_at)} 거점전 순번 명단</h2>
        <button type="button" className={styles.btnSm} onClick={() => setOpenSurvey(null)}>
          목록으로
        </button>
      </div>

      <div>
        <div className={styles.statGrid}>
          {VOTES.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`${styles.stat} ${filter === kind ? styles.statOn : ""}`}
              onClick={() => setFilter(filter === kind ? null : kind)}
            >
              <span className={styles.statKey}>{kind}</span>
              <div className={styles.statNum}>
                {kind === "참여" ? counts["참여"] + counts["부속"] : counts[kind]}
              </div>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.stat} ${filter === "미투표" ? styles.statOn : ""}`}
            onClick={() => setFilter(filter === "미투표" ? null : "미투표")}
          >
            <span className={styles.statKey}>미투표</span>
            <div className={`${styles.statNum} ${styles.statNumMute}`}>{nonVoterCount}</div>
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {filter === null || filter === "참여" ? (
          <RosterTable key={filter ?? "base"} members={members} cap={cap} />
        ) : filter === "미투표" ? (
          <RosterTable key="unvoted" members={members} list={nonVoterList} cap={cap} />
        ) : (
          <RosterTable key={filter} members={members} list={ofVote(members, filter)} cap={cap} />
        )}
      </div>
    </section>
  );
}
