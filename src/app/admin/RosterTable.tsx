"use client";

import { Fragment, useState } from "react";
import styles from "./admin.module.css";
import { type Member, rosterOf } from "./adminData";

type SortKey = "seq" | "nick" | "guild" | "job" | "line" | "vote" | "time";

const COLUMNS: [SortKey, string][] = [
  ["seq", "순번"],
  ["nick", "닉네임"],
  ["guild", "소속 길드"],
  ["job", "직업"],
  ["line", "계열"],
  ["vote", "부속"],
  ["time", "넣은 시각"],
];

interface RosterTableProps {
  members: Member[];
  /* 지정하면 순번 명단 대신 이 목록을 그대로 보여준다 (필터 보기, 컷 라인 없음) */
  list?: Member[];
  cap: number;
  /* 운영 탭은 편집 가능, 지난 투표 탭은 읽기 전용으로 같은 표를 쓴다 */
  editable?: boolean;
  flashId?: string | null;
  onReorder?: (id: string, targetId: string) => void;
  onRemove?: (id: string) => void;
}

function sortValue(m: Member, key: SortKey, seqOf: Map<string, number>) {
  if (key === "seq") return seqOf.get(m.id) ?? 0;
  if (key === "vote") return m.vote === "부속" ? "부속" : "";
  return m[key];
}

export function RosterTable({
  members,
  list,
  cap,
  editable = false,
  flashId = null,
  onReorder,
  onRemove,
}: RosterTableProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const roster = list ?? rosterOf(members);
  const seqOf = new Map(roster.map((m, i) => [m.id, i + 1]));
  const display = sort
    ? [...roster].sort((a, b) => {
        const va = sortValue(a, sort.key, seqOf);
        const vb = sortValue(b, sort.key, seqOf);
        const base = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
        return sort.dir === "asc" ? base : -base;
      })
    : roster;
  // 순번 오름차순은 원래 순서와 같으므로 컷 라인과 드래그를 살려 둔다
  const naturalOrder = !sort || (sort.key === "seq" && sort.dir === "asc");
  const showCut = !list && naturalOrder;
  const canDrag = editable && naturalOrder;

  function cycleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function sortMark(key: SortKey) {
    if (!sort || sort.key !== key) return "↕";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.cNo} />
          <col className={styles.cEven} />
          <col className={styles.cEven} />
          <col className={styles.cEven} />
          <col className={styles.cEven} />
          <col className={styles.cEven} />
          <col className={styles.cEven} />
          <col className={styles.cAct} />
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map(([key, label]) => (
              <th key={key}>
                <button type="button" className={styles.sortBtn} onClick={() => cycleSort(key)}>
                  {label} <span className={sort?.key === key ? styles.sortOn : styles.sortOff}>{sortMark(key)}</span>
                </button>
              </th>
            ))}
            <th aria-label="관리" />
          </tr>
        </thead>
        <tbody>
          {display.map((m) => {
            const seq = seqOf.get(m.id) ?? 0;
            // 조정 뱃지는 선착순 원 위치와 비교해 컷 경계를 넘어간 사람에게만 붙는다
            const crossed = !list && seq > 0 && (m.origSeq <= cap) !== (seq <= cap);
            const rowClass = [
              seq > cap ? styles.reserve : "",
              dragId === m.id ? styles.dragging : "",
              dropId === m.id && dragId !== m.id ? styles.dropTarget : "",
              flashId === m.id ? styles.justIn : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Fragment key={m.id}>
                {showCut && seq === cap + 1 && (
                  <tr className={styles.cutRow}>
                    <td colSpan={8}>정원 {cap}인 컷</td>
                  </tr>
                )}
                <tr
                  className={rowClass}
                  draggable={canDrag}
                  title={canDrag ? "행을 끌어 원하는 자리와 교체" : undefined}
                  onDragStart={canDrag ? () => setDragId(m.id) : undefined}
                  onDragEnd={
                    canDrag
                      ? () => {
                          setDragId(null);
                          setDropId(null);
                        }
                      : undefined
                  }
                  onDragOver={
                    canDrag
                      ? (e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          setDropId(m.id);
                        }
                      : undefined
                  }
                  onDrop={
                    canDrag
                      ? (e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          onReorder?.(dragId, m.id);
                          setDragId(null);
                          setDropId(null);
                        }
                      : undefined
                  }
                >
                  <td className={styles.no}>{seq}</td>
                  <td className={styles.nick}>
                    {m.nick}
                    {crossed && (
                      <span className={styles.adjBadge} title={`선착순 원 순번 ${m.origSeq}번`}>
                        조정
                      </span>
                    )}
                  </td>
                  <td className={styles.guild}>{m.guild}</td>
                  <td className={styles.job}>{m.job}</td>
                  <td className={styles.lineCell}>{m.line}</td>
                  <td className={styles.lineCell}>{m.vote === "부속" ? "부속" : ""}</td>
                  <td className={styles.time}>{m.time}</td>
                  <td className={styles.act}>
                    {editable && (
                      <button
                        type="button"
                        className={styles.rm}
                        title="이 회차 표 빼기"
                        onClick={() => onRemove?.(m.id)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {display.length === 0 && <div className={styles.tableEmpty}>아직 들어온 표가 없습니다</div>}
    </div>
  );
}
