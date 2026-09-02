"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatSurveyDate } from "@/lib/format";
import type { VoterRow } from "@/lib/queries";
import type { DbSurvey } from "@/lib/types";
import { fetchOriginalRoster, fetchRoster } from "./actions";
import { addVoteAction, removeVoteAction, saveRosterOrderAction } from "./rosterActions";
import styles from "./admin.module.css";
import { RosterTable } from "./RosterTable";
import { type Member, type PresetControls, VOTES, type Vote, buildExportText, countsOf, ofVote, rosterOf, votersToMembers } from "./adminData";

const POLL_MS = 5000;

interface NonVoterRow {
  nickname: string;
  guildName: string;
}

interface OperationTabProps {
  presets: PresetControls;
  showToast: (text: string) => void;
  /* 마감 여부. 라이브 배지와 폴링 주기에만 쓴다. */
  closed: boolean;
  /* 거점전이 끝나고 다음 투표가 열리기 전까지의 대기 상태 */
  waiting: boolean;
  current: DbSurvey | null;
}

export function OperationTab({ presets, showToast, closed, waiting, current }: OperationTabProps) {
  const { cap, setCap } = presets;

  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [nonVoters, setNonVoters] = useState<NonVoterRow[]>([]);
  const [capEdit, setCapEdit] = useState(false);
  const [newPreset, setNewPreset] = useState("");
  const [filter, setFilter] = useState<Vote | "미투표" | null>(null);
  /* 마감 뒤 드래그 조정은 저장을 누르기 전까지 화면에만 쌓인다 */
  const [draft, setDraft] = useState<Member[] | null>(null);
  const [addName, setAddName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [history, setHistory] = useState<Member[][]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  /* 마감 전에는 확정 명단이 아직 없다. 그동안은 원본 집계만 보여주고 편집을 막는다. */
  const [confirmed, setConfirmed] = useState(false);
  const currentId = current?.id;

  /*
   * 라이브 중에는 몇 초마다 표를 다시 읽어온다. 마감이나 대기 상태면 한 번만.
   * 조정을 시작한 뒤에는 멈춘다 — 마감 뒤라 새 표가 들어올 일이 없는데,
   * 드래그하는 중에 목록이 갈리면 놓는 자리가 어긋난다.
   */
  const adjusting = draft !== null;
  useEffect(() => {
    if (!currentId) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchRoster(currentId);
        if (alive) {
          setVoters(r.voters);
          setNonVoters(r.nonVoters);
          setConfirmed(r.confirmed);
        }
      } catch {
        // 폴링 한 번이 흔들린 것은 다음 번에 만회된다
      }
    };
    load();
    if (closed || waiting || adjusting) {
      return () => {
        alive = false;
      };
    }
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [currentId, closed, waiting, adjusting]);

  const loaded = useMemo(() => votersToMembers(voters), [voters]);
  // 조정 중에는 최신 명단에 조정해 둔 순서만 입힌다. 새 표는 자연히 맨 뒤로 간다.
  const members = useMemo(() => {
    if (!draft) return loaded;
    const ordOf = new Map(draft.map((m) => [m.id, m.ord]));
    let next = Math.max(0, ...ordOf.values()) + 1;
    return loaded.map((m) => ({ ...m, ord: ordOf.get(m.id) ?? next++ }));
  }, [draft, loaded]);
  const counts = countsOf(members);
  const roster = rosterOf(members);
  const reserve = Math.max(0, roster.length - cap);
  const heading = current ? formatSurveyDate(current.executed_at) : "";

  /*
   * 드래그한 행을 놓은 자리로 옮기고 그 사이 사람들을 한 칸씩 민다.
   *
   * 예전에는 두 행의 순번을 맞바꿨다. 한 칸 옮길 때는 결과가 같지만, 80번을
   * 49번으로 끌어올리면 49번이던 사람이 80번으로 튕겨 나가 명단이 엉켰다.
   * 끌어서 놓는 동작에서 기대하는 것은 교환이 아니라 이동이다.
   *
   * 순번은 명단(참여·부속)에만 있으므로 그 안에서만 다시 매긴다.
   */
  function reorder(id: string, targetId: string) {
    if (id === targetId) return;
    const base = draft ?? loaded;
    const list = rosterOf(base);
    const from = list.findIndex((m) => m.id === id);
    const to = list.findIndex((m) => m.id === targetId);
    if (from < 0 || to < 0) return;

    const moved = list.slice();
    const [item] = moved.splice(from, 1);
    moved.splice(to, 0, item);

    setHistory((h) => [...h.slice(-19), base.map((m) => ({ ...m }))]);
    const ordById = new Map(moved.map((m, i) => [m.id, i]));
    setDraft(base.map((m) => ({ ...m, ord: ordById.get(m.id) ?? m.ord })));
    setFlashId(id);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setDraft(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  async function reload() {
    if (!current) return;
    const r = await fetchRoster(current.id);
    setVoters(r.voters);
    setNonVoters(r.nonVoters);
    setConfirmed(r.confirmed);
    setDraft(null);
    setHistory([]);
  }

  function save() {
    if (!current || !draft) return;
    startSave(async () => {
      try {
        await saveRosterOrderAction(
          current.id,
          rosterOf(draft).map((m) => m.id),
        );
        await reload();
        showToast("명단 조정이 저장되었습니다");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "저장에 실패했습니다");
      }
    });
  }

  async function copyList() {
    const text = buildExportText(members, cap, heading);
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

  /*
   * 원본으로 되돌리기. 사람들이 실제로 누른 표를 투표순 그대로 화면에 올린다.
   * 화면만 바뀌고 확정 명단은 저장을 눌러야 바뀐다.
   */
  function restoreOriginal() {
    if (!current) return;
    startSave(async () => {
      try {
        const rows = await fetchOriginalRoster(current.id);
        setHistory((h) => [...h.slice(-19), (draft ?? loaded).map((m) => ({ ...m }))]);
        setDraft(votersToMembers(rows));
        showToast("원본 투표 순서로 되돌렸습니다. 저장해야 확정됩니다");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "되돌리기에 실패했습니다");
      }
    });
  }

  function addVote() {
    if (!current) return;
    const name = addName.trim();
    if (!name) return;
    startSave(async () => {
      try {
        await addVoteAction(current.id, name);
        await reload();
        setAddName("");
        showToast(`${name} 님을 이 회차 명단에 추가했습니다`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "추가에 실패했습니다");
      }
    });
  }

  function removeVote(historyId: string) {
    if (!current) return;
    const gone = members.find((m) => m.id === historyId);
    startSave(async () => {
      try {
        await removeVoteAction(current.id, historyId);
        await reload();
        showToast(gone ? `${gone.nick} 님의 이 회차 표를 뺐습니다` : "표를 뺐습니다");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "빼기에 실패했습니다");
      }
    });
  }

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>
        {current ? `${formatSurveyDate(current.executed_at)} 거점전 순번 명단` : "거점전 순번 명단"}
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
            <div className={`${styles.statNum} ${styles.statNumMute}`}>{nonVoters.length}</div>
          </button>
        </div>
      </div>

      {!confirmed && (
        <p className={styles.hint}>
          투표가 마감되면 확정 명단이 만들어지고 순번 조정을 할 수 있습니다. 그때까지는 집계만
          보여줍니다.
        </p>
      )}

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
          {/* 정원 제한 없이 전체를 본다. 프리셋이 아니므로 삭제 대상이 아니다. */}
          <button
            type="button"
            className={`${styles.presetChip} ${cap === Infinity ? styles.presetOn : ""}`}
            onClick={() => setCap(Infinity)}
          >
            전체
          </button>
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
            placeholder="닉네임 입력"
            disabled={isSaving || !confirmed}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addVote();
            }}
          />
          <button
            type="button"
            className={styles.btnSm}
            onClick={addVote}
            disabled={isSaving || !confirmed}
          >
            추가
          </button>
        </div>

        {filter === null || filter === "참여" ? (
          <RosterTable
            key={filter ?? "base"}
            members={members}
            cap={cap}
            editable={confirmed}
            flashId={flashId}
            onReorder={reorder}
            onRemove={removeVote}
          />
        ) : filter === "미투표" ? (
          <RosterTable
            key="unvoted"
            members={members}
            list={nonVoters.map((n, i) => ({
              id: n.nickname,
              nick: n.nickname,
              guild: n.guildName,
              job: "-",
              line: "-",
              vote: "미참" as const,
              ord: i,
              origSeq: i + 1,
              time: "-",
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
            disabled={history.length === 0}
            title="직전 조정 한 단계를 취소합니다"
          >
            실행 취소
          </button>
          <button
            type="button"
            className={styles.btnSm}
            onClick={restoreOriginal}
            disabled={!confirmed || isSaving}
            title="사람들이 실제로 누른 표 순서로 화면을 되돌립니다. 저장해야 확정됩니다"
          >
            원본으로 되돌리기
          </button>
          <button
            type="button"
            className={`${styles.btnSm} ${draft ? styles.btnPrimary : ""}`}
            onClick={save}
            disabled={!draft || isSaving}
          >
            {isSaving ? "저장 중..." : "확정 명단 저장"}
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={() => setExportOpen(true)}>
            미리보기
          </button>
          <button type="button" className={`${styles.btnSm} ${styles.btnPrimary}`} onClick={copyList}>
            명단 복사
          </button>
        </div>
      </div>

      {exportOpen && (
        <div className={styles.modal} role="presentation" onClick={() => setExportOpen(false)}>
          <div className={styles.modalPanel} role="presentation" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.label}>명단 미리보기</span>
              <button type="button" className={styles.xclose} onClick={() => setExportOpen(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <pre className={styles.preview}>{buildExportText(members, cap, heading)}</pre>
            </div>
            <div className={styles.modalFoot}>
              <span className={styles.hint}>
                {cap === Infinity ? "전체" : `정원 ${cap}인 기준`} · 참여{" "}
                {Math.min(roster.length, cap)} / 예비 {reserve}
              </span>
              <span className={styles.spacer} />
              <button type="button" className={styles.btnSm} onClick={() => setExportOpen(false)}>
                닫기
              </button>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnPrimary}`}
                onClick={() => {
                  copyList();
                  setExportOpen(false);
                }}
              >
                복사
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
