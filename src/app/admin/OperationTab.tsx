"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatKstTimeWithSeconds, formatSurveyDate } from "@/lib/format";
import type { VoterRow } from "@/lib/queries";
import { CLASS_TYPE_LABEL, type DbSurvey, VOTING_TYPE_LABEL } from "@/lib/types";
import { formatDayDate } from "@/lib/week";
import { fetchVoters } from "./actions";
import { addVoteAction, removeVoteAction, saveRosterOrderAction } from "./rosterActions";
import styles from "./admin.module.css";
import { RosterTable } from "./RosterTable";
import { type Member, type PresetControls, VOTES, type Vote, countsOf, ofVote, rosterOf } from "./adminData";

const POLL_MS = 5000;

interface NonVoterRow {
  nickname: string;
  guildName: string;
}

interface OperationTabProps {
  presets: PresetControls;
  showToast: (text: string) => void;
  /* 순번 조정과 발표는 마감 뒤에만 연다. 라이브 중에는 집계만 지켜본다. */
  closed: boolean;
  /* 거점전이 끝나고 다음 투표가 열리기 전까지의 대기 상태 */
  waiting: boolean;
  current: DbSurvey | null;
}

/* 표 목록을 화면 명단으로 바꾼다. 순번은 참여와 부속끼리만 매긴다. */
function toMembers(voters: VoterRow[]): Member[] {
  let rosterSeq = 0;
  let restSeq = 0;
  return voters.map((v) => {
    const vote = VOTING_TYPE_LABEL[v.votingType] as Vote;
    const inRoster = vote === "참여" || vote === "부속";
    const ord = inRoster ? rosterSeq : restSeq;
    if (inRoster) rosterSeq += 1;
    else restSeq += 1;
    const votedAt = new Date(v.votedAt);
    return {
      id: v.historyId,
      nick: v.nickname,
      guild: v.guildName,
      job: v.className ?? "-",
      line: v.classType ? CLASS_TYPE_LABEL[v.classType] : "-",
      vote,
      ord,
      origSeq: ord + 1,
      time: `${formatDayDate(votedAt)} ${formatKstTimeWithSeconds(votedAt)}`,
    };
  });
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
  const [history, setHistory] = useState<Member[][]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  /* 라이브 중에는 몇 초마다 표를 다시 읽어온다. 마감이나 대기 상태면 한 번만. */
  useEffect(() => {
    setDraft(null);
    setHistory([]);
    if (!current) {
      setVoters([]);
      setNonVoters([]);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetchVoters(current.id);
        if (alive) {
          setVoters(r.voters);
          setNonVoters(r.nonVoters);
        }
      } catch {
        // 폴링 한 번이 흔들린 것은 다음 번에 만회된다
      }
    };
    load();
    if (closed || waiting) {
      return () => {
        alive = false;
      };
    }
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [current, closed, waiting]);

  const loaded = useMemo(() => toMembers(voters), [voters]);
  const members = draft ?? loaded;
  const counts = countsOf(members);

  // 드래그한 행과 놓은 자리 행의 순번을 서로 맞바꾼다
  function reorder(id: string, targetId: string) {
    if (id === targetId) return;
    const base = draft ?? loaded;
    const next = base.map((m) => ({ ...m }));
    const a = next.find((m) => m.id === id);
    const b = next.find((m) => m.id === targetId);
    if (!a || !b) return;
    setHistory((h) => [...h.slice(-19), base.map((m) => ({ ...m }))]);
    const t = a.ord;
    a.ord = b.ord;
    b.ord = t;
    setDraft(next);
    setFlashId(a.id);
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
    const r = await fetchVoters(current.id);
    setVoters(r.voters);
    setNonVoters(r.nonVoters);
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
            disabled={!closed || isSaving}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addVote();
            }}
          />
          <button type="button" className={styles.btnSm} onClick={addVote} disabled={!closed || isSaving}>
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
          <button type="button" className={styles.btnSm} onClick={undo} disabled={history.length === 0}>
            되돌리기
          </button>
          <button
            type="button"
            className={styles.btnSm}
            onClick={save}
            disabled={!draft || isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} disabled title="발표는 다음 커밋에서 연결됩니다">
            명단 복사
          </button>
          <button type="button" className={styles.btnSm} disabled title="발표는 다음 커밋에서 연결됩니다">
            디코로 결과 보내기
          </button>
        </div>
      </div>
    </section>
  );
}
