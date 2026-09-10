"use client";

import { ClassIcon } from "@/components/ClassIcon";
import { CLASS_TYPE_LABEL } from "@/lib/types";
import { type Member, classStatsOf, rosterOf } from "./adminData";
import styles from "./admin.module.css";

/*
 * 명단에 누가 서 있는지가 아니라 무엇이 서 있는지를 본다. 전승이 몇, 각성이 몇,
 * 어느 직업이 몰려 있는지.
 *
 * 정원 안에 드는 사람만 센다. 55 인과 100 인은 실제로 나가는 사람이 다르므로
 * 분포도 다르다. 정원을 바꾸면 이 숫자도 함께 바뀐다.
 */
export function ClassStats({ members, cap }: { members: Member[]; cap: number }) {
  const roster = rosterOf(members);
  const going = roster.slice(0, cap);
  const stats = classStatsOf(going);
  const reserve = Math.max(0, roster.length - going.length);
  const share = (count: number) => (stats.total ? Math.round((count / stats.total) * 100) : 0);

  if (!roster.length) return null;

  return (
    <section className={styles.card} aria-label="직업 분포">
      <div className={styles.rosterBar}>
        <span className={styles.label}>
          직업 분포 · {cap === Infinity ? "전체" : `정원 ${cap}인 기준`} {stats.total}명
          {reserve > 0 && ` · 예비 ${reserve}명 제외`}
          {stats.unknown > 0 && ` · 직업 미등록 ${stats.unknown}명`}
        </span>
      </div>

      <div className={styles.lineGrid}>
        {stats.byLine.map(({ type, count }) => (
          <div key={type} className={styles.lineStat} data-line={type}>
            <span className={styles.lineKey}>{CLASS_TYPE_LABEL[type]}</span>
            <span className={`${styles.lineNum} ${styles.mono}`}>{count}</span>
            <span className={`${styles.lineShare} ${styles.mono}`}>{share(count)}%</span>
            <span className={styles.lineBar} aria-hidden="true">
              <span style={{ width: `${share(count)}%` }} />
            </span>
          </div>
        ))}
      </div>

      {stats.byJob.length > 0 && (
        <ul className={styles.jobList}>
          {stats.byJob.map((entry) => (
            <li key={`${entry.classType}:${entry.job}`} className={styles.jobChip}>
              <ClassIcon name={entry.job} type={entry.classType} size={22} markSize={11} />
              <span className={styles.jobName}>{entry.job}</span>
              <span className={`${styles.jobCount} ${styles.mono}`}>{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
