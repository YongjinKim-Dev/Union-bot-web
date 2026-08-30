"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";
import { RosterTable } from "./RosterTable";
import {
  type Member,
  type PresetControls,
  VOTES,
  type Vote,
  buildExportText,
  countsOf,
  ofVote,
  rosterOf,
} from "./adminData";
import { NEXT_SURVEY, SURVEYS, UNVOTED, buildMembers, mockLiveVote, nowStamp } from "./adminMock";

const TODAY = SURVEYS[0];

interface OperationTabProps {
  presets: PresetControls;
  showToast: (text: string) => void;
  /* 순번 조정과 발표는 마감 뒤에만 연다. 라이브 중에는 집계만 지켜본다. */
  closed: boolean;
  /* 거점전이 끝나고 다음 투표가 열리기 전까지의 대기 상태 */
  waiting: boolean;
}

export function OperationTab({ presets, showToast, closed, waiting }: OperationTabProps) {
  const { cap, setCap } = presets;

  const survey = waiting ? NEXT_SURVEY : TODAY;
  const [members, setMembers] = useState<Member[]>(() => (waiting ? [] : buildMembers(TODAY, 0)));
  const [addName, setAddName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [capEdit, setCapEdit] = useState(false);
  const [newPreset, setNewPreset] = useState("");
  const [history, setHistory] = useState<Member[][]>([]);
  const [filter, setFilter] = useState<Vote | "미투표" | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (closed || waiting) return undefined;
    const timer = setInterval(() => {
      seqRef.current += 1;
      const id = `live-${seqRef.current}`;
      const time = nowStamp(survey.key);
      setMembers((prev) => {
        const vote = mockLiveVote(prev, id, time);
        return vote ? [...prev, vote] : prev;
      });
      setFlashId(id);
    }, 4200);
    return () => clearInterval(timer);
  }, [closed, waiting]);

  const counts = countsOf(members);
  const roster = rosterOf(members);
  const reserve = Math.max(0, roster.length - cap);

  function snapshot() {
    setHistory((h) => [...h.slice(-19), members.map((m) => ({ ...m }))]);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setMembers(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function save() {
    setHistory([]);
    showToast("명단 조정이 저장되었습니다");
  }

  // 드래그한 행과 놓은 자리 행의 순번을 서로 맞바꾼다
  function reorder(id: string, targetId: string) {
    if (id === targetId) return;
    snapshot();
    const next = members.map((m) => ({ ...m }));
    const a = next.find((m) => m.id === id);
    const b = next.find((m) => m.id === targetId);
    if (!a || !b) return;
    const t = a.ord;
    a.ord = b.ord;
    b.ord = t;
    setMembers(next);
    setFlashId(a.id);
  }

  function removeVote(id: string) {
    snapshot();
    const next = members.filter((m) => m.id !== id).map((m) => ({ ...m }));
    rosterOf(next).forEach((m, i) => {
      m.ord = i;
    });
    setMembers(next);
  }

  function addVote() {
    const name = addName.trim();
    if (!name) return;
    snapshot();
    seqRef.current += 1;
    const next = roster.length;
    const time = nowStamp(survey.key);
    setMembers((prev) => [
      ...prev,
      {
        id: `add-${seqRef.current}`,
        nick: name,
        guild: "미상",
        job: "미상",
        line: "기타",
        vote: "참여",
        ord: next,
        origSeq: next + 1,
        time,
      },
    ]);
    setAddName("");
  }

  async function copyList() {
    const text = buildExportText(members, cap, survey);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("명단이 복사되었습니다");
  }

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>
        {survey.key} ({survey.dow}) 거점전 순번 명단
      </h2>

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
        <div className={styles.rosterBar}>
          <span className={styles.label}>정원컷</span>
          {presets.presets.map((p, i) => (
            <span key={p} className={styles.presetWrap}>
              <button
                type="button"
                className={`${styles.presetChip} ${cap === p ? styles.presetOn : ""}`}
                onClick={() => setCap(p)}
              >
                {p}인
              </button>
              {capEdit && (
                <button
                  type="button"
                  className={styles.presetRm}
                  title="프리셋 삭제"
                  onClick={() => presets.remove(i)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {capEdit && (
            <>
              <input
                className={`${styles.input} ${styles.mono} ${styles.capInput}`}
                type="number"
                min={1}
                placeholder="새 값"
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    presets.add(newPreset);
                    setNewPreset("");
                  }
                }}
              />
              <button
                type="button"
                className={styles.btnSm}
                onClick={() => {
                  presets.add(newPreset);
                  setNewPreset("");
                }}
              >
                추가
              </button>
            </>
          )}
          <button
            type="button"
            className={`${styles.pencil} ${capEdit ? styles.pencilOn : ""}`}
            title={capEdit ? "편집 완료" : "프리셋 수정"}
            onClick={() => setCapEdit((v) => !v)}
          >
            ✎
          </button>
          <input
            className={`${styles.input} ${styles.addInput} ${styles.pushRight}`}
            placeholder={closed ? "닉네임 입력" : "마감 후 조정 가능"}
            disabled={!closed}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addVote();
            }}
          />
          <button type="button" className={styles.btnSm} onClick={addVote} disabled={!closed}>
            추가
          </button>
        </div>

        {filter === null || filter === "참여" ? (
          <RosterTable
            key={filter ?? "base"}
            members={members}
            cap={cap}
            editable={closed}
            flashId={flashId}
            onReorder={reorder}
            onRemove={removeVote}
          />
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

        <div className={styles.rosterAct}>
          <button
            type="button"
            className={styles.btnSm}
            onClick={undo}
            disabled={!closed || history.length === 0}
          >
            되돌리기
          </button>
          <button
            type="button"
            className={styles.btnSm}
            onClick={save}
            disabled={!closed || history.length === 0}
          >
            저장
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={copyList} disabled={!closed}>
            명단 복사
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${closed ? styles.btnPrimary : ""}`}
            onClick={() => setExportOpen(true)}
            disabled={!closed}
          >
            디코로 결과 보내기
          </button>
        </div>
      </div>

      {exportOpen && (
        <div className={styles.modal} role="presentation" onClick={() => setExportOpen(false)}>
          <div className={styles.modalPanel} role="presentation" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.label}>디코 발송 미리보기</span>
              <button type="button" className={styles.xclose} onClick={() => setExportOpen(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <pre className={styles.preview}>{buildExportText(members, cap, survey, false)}</pre>
            </div>
            <div className={styles.modalFoot}>
              <span className={styles.hint}>
                정원 {cap}인 기준 · 본대 {Math.min(roster.length, cap)} / 예비 {reserve}
              </span>
              <span className={styles.spacer} />
              <button type="button" className={styles.btnSm} onClick={() => setExportOpen(false)}>
                취소
              </button>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnPrimary}`}
                onClick={() => {
                  setExportOpen(false);
                  showToast("디코로 결과를 보냈습니다");
                }}
              >
                보내기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
