"use client";

import { useState } from "react";
import styles from "./admin.module.css";
import { RosterTable } from "./RosterTable";
import { type Member, VOTES, type Vote, countsOf, ofVote } from "./adminData";
import { PAST_SURVEYS, UNVOTED, buildMembers } from "./adminMock";

interface PastVotesTabProps {
  cap: number;
}

const PAGE_SIZE = 15;

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
  const [openIso, setOpenIso] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Vote | "미투표" | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(PAST_SURVEYS.length / PAGE_SIZE);
  const survey = openIso ? PAST_SURVEYS.find((s) => s.iso === openIso) : undefined;
  const counts = countsOf(members);

  function open(iso: string) {
    const idx = PAST_SURVEYS.findIndex((s) => s.iso === iso);
    if (idx < 0) return;
    setOpenIso(iso);
    setFilter(null);
    setMembers(buildMembers(PAST_SURVEYS[idx], idx * 7));
  }

  if (!survey) {
    return (
      <section>
        <div className={styles.pastList}>
          <div className={styles.surveyList}>
            {PAST_SURVEYS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => (
              <button key={s.iso} type="button" className={styles.sRow} onClick={() => open(s.iso)}>
                <span className={styles.sCol}>
                  <span className={styles.sTitle}>
                    {s.key} ({s.dow}) {s.battle} 거점전
                  </span>
                  <span className={styles.sSub}>
                    참여 {s.counts["참여"] + s.counts["부속"]} · 부속 {s.counts["부속"]} · 늦참 {s.counts["늦참"]} · 미참 {s.counts["미참"]}
                  </span>
                </span>
                <span className={styles.sLink}>투표자 보기</span>
              </button>
            ))}
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
        <h2 className={styles.rosterTitle}>
          {survey.key} ({survey.dow}) 거점전 순번 명단
        </h2>
        <button type="button" className={styles.btnSm} onClick={() => setOpenIso(null)}>
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
            <div className={`${styles.statNum} ${styles.statNumMute}`}>{UNVOTED.length}</div>
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {filter === null || filter === "참여" ? (
          <RosterTable key={filter ?? "base"} members={members} cap={cap} />
        ) : filter === "미투표" ? (
          <RosterTable
            key="unvoted"
            members={members}
            list={UNVOTED.map((nick, i) => ({
              id: `unvoted-${i}`,
              nick,
              guild: "—",
              job: "—",
              line: "—",
              vote: "미참" as const,
              ord: i,
              origSeq: i + 1,
              time: "—",
            }))}
            cap={cap}
          />
        ) : (
          <RosterTable key={filter} members={members} list={ofVote(members, filter)} cap={cap} />
        )}
      </div>
    </section>
  );
}
