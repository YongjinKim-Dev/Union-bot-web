"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatKstDateTime } from "@/lib/format";
import { SpecViewer } from "@/app/equipment/SpecViewer";
import type { SpecSubmissionListRow } from "@/lib/specQueries";
import styles from "./admin.module.css";
import { fetchSpecSubmissions, type SpecSurveyView } from "./specActions";

/*
 * 무엇을 기준으로 줄을 세울지는 보려는 것에 따라 다르다 — 전체 스펙은 공방합,
 * 탱커는 DP, 특정 사람을 찾을 때는 닉네임, 늦게 낸 사람은 제출 시각.
 *
 * desc 는 처음 눌렀을 때의 방향이다. 수치는 높은 쪽이, 이름은 가나다순이,
 * 시각은 최근이 먼저 궁금하다.
 */
const SORTS = [
  { key: "score", label: "공방합", desc: true },
  { key: "ap", label: "AP", desc: true },
  { key: "aap", label: "AAP", desc: true },
  { key: "dp", label: "DP", desc: true },
  { key: "nickname", label: "닉네임", desc: false },
  { key: "submittedAt", label: "제출 시각", desc: true },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
/** 공방합·AP·AAP·DP 는 수치라 미확인 제출을 함께 줄 세울 수 없다. */
const NUMERIC: SortKey[] = ["score", "ap", "aap", "dp"];

function at(row: SpecSubmissionListRow, key: SortKey): number | string {
  if (key === "nickname") return row.nickname;
  if (key === "submittedAt") return new Date(row.submittedAt).getTime();
  return row[key];
}

/*
 * 낸 스펙을 줄 세워 본다. 행을 누르면 그 사람이 낸 세팅이 펼쳐지는데,
 * 연맹원이 쓰는 화면과 같은 판이고 고르는 기능만 없다. 낸 값은 굳어 있으므로
 * 여기서 고칠 것도 없다.
 */
export function SpecTab() {
  const [survey, setSurvey] = useState<SpecSurveyView | null>(null);
  const [rows, setRows] = useState<SpecSubmissionListRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [desc, setDesc] = useState(true);
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

  function chooseSort(key: SortKey) {
    // 보고 있던 기준을 다시 누르면 방향만 뒤집는다.
    if (key === sortKey) { setDesc(v => !v); return; }
    setSortKey(key);
    setDesc(SORTS.find(s => s.key === key)!.desc);
  }

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (NUMERIC.includes(sortKey) && a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
      const left = at(a, sortKey), right = at(b, sortKey);
      const diff = typeof left === "string" && typeof right === "string"
        ? left.localeCompare(right as string, "ko")
        : (left as number) - (right as number);
      if (diff !== 0) return desc ? -diff : diff;
      // 값이 같으면 어느 방향으로 보든 먼저 낸 사람이 앞이다.
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });
    return list;
  }, [rows, sortKey, desc]);

  async function copyList() {
    const text = sorted
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
        기본은 공방합이 높은 순이고, 아래에서 기준을 바꿀 수 있습니다.
        행을 누르면 그 사람이 낸 장비·수정·광명석을 볼 수 있습니다.
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

        <div className={styles.sortBar} role="group" aria-label="정렬 기준">
          <span className={styles.label}>정렬</span>
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`${styles.btnXs} ${option.key === sortKey ? styles.btnPrimary : ""}`}
              aria-pressed={option.key === sortKey}
              title={option.key === sortKey ? "다시 누르면 방향이 바뀝니다" : `${option.label} 기준으로 줄 세우기`}
              onClick={() => chooseSort(option.key)}
            >
              {option.label}
              {option.key === sortKey && <span aria-hidden="true"> {desc ? "▾" : "▴"}</span>}
            </button>
          ))}
        </div>

        {copied && <p className={styles.hint}>{copied}</p>}

        {!rows.length && !isLoading && (
          <p className={styles.hint}>아직 아무도 스펙을 내지 않았습니다.</p>
        )}

        <ol className={styles.specList}>
          {sorted.map((row, index) => {
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
