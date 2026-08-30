"use client";

import { useState, useTransition } from "react";
import { fetchVoters, registerSurvey } from "./actions";
import { VOTING_TYPE_LABEL, CLASS_TYPE_LABEL, type ClassType, type VotingType } from "@/lib/types";
import { formatKstTimeWithSeconds } from "@/lib/format";
import styles from "./admin.module.css";

interface SurveyRow {
  id: string;
  status: string;
  executedLabel: string;
  exposedLabel: string;
}

interface Voter {
  nickname: string;
  guildName: string;
  votingType: VotingType;
  className: string | null;
  classType: ClassType | null;
  votedAt: string | Date;
}

const VOTE_ORDER: VotingType[] = ["attend", "boarding", "late_attend", "non_attend"];

export function AdminPanel({ surveys }: { surveys: SurveyRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [nonVoters, setNonVoters] = useState<{ nickname: string; guildName: string }[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [executedAt, setExecutedAt] = useState("");
  const [exposedAt, setExposedAt] = useState("");
  const [announceMinutes, setAnnounceMinutes] = useState("15");
  const [announceContent, setAnnounceContent] = useState("");
  const [isSaving, startSave] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function openVoters(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setError(null);
    startLoad(async () => {
      try {
        const data = await fetchVoters(id);
        setVoters(data.voters);
        setNonVoters(data.nonVoters);
      } catch (e) {
        setError(e instanceof Error ? e.message : "조회에 실패했습니다.");
      }
    });
  }

  function submit() {
    setResult(null);
    setError(null);
    startSave(async () => {
      try {
        const r = await registerSurvey({
          executedAt,
          exposedAt,
          announceMinutesBefore: Number(announceMinutes),
          announceContent,
        });
        setResult(
          r.announceAt
            ? `등록 완료 (id ${r.surveyId}). ${r.announceAt} 에 디스코드로 공지됩니다.`
            : `등록 완료 (id ${r.surveyId}). 공지는 보내지 않습니다.`,
        );
        setExecutedAt("");
        setExposedAt("");
        setAnnounceContent("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "등록에 실패했습니다.");
      }
    });
  }

  const counts = VOTE_ORDER.map((t) => ({
    type: t,
    n: voters.filter((v) => v.votingType === t).length,
  }));

  return (
    <>
      <section>
        <h2 className={styles.sectionTitle}>설문 등록</h2>
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>거점전 일시</span>
            <input
              type="datetime-local"
              className={styles.input}
              value={executedAt}
              onChange={(e) => setExecutedAt(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>투표 여는 시각</span>
            <input
              type="datetime-local"
              className={styles.input}
              value={exposedAt}
              onChange={(e) => setExposedAt(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>공지 시점 (투표 열리기 N분 전)</span>
            <input
              type="number"
              min={0}
              className={`${styles.input} ${styles.inputNarrow}`}
              value={announceMinutes}
              onChange={(e) => setAnnounceMinutes(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!executedAt || !exposedAt || isSaving}
            onClick={submit}
          >
            {isSaving ? "등록 중..." : "설문 등록"}
          </button>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>공지 문구 (비우면 기본 문구가 들어갑니다)</span>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="비워두면 날짜·투표 시각·링크가 들어간 기본 문구로 나갑니다."
            value={announceContent}
            onChange={(e) => setAnnounceContent(e.target.value)}
          />
        </label>
        <p className={styles.hint}>
          시각은 한국 시간 기준입니다. 투표는 여는 시각에 모두에게 동시에 열리고, 거점전 1시간
          전에 마감됩니다. 공지 시점을 0 으로 두면 공지하지 않습니다.
        </p>
        {result && <p className={styles.success}>{result}</p>}
      </section>

      <section className={styles.spaced}>
        <h2 className={styles.sectionTitle}>설문 목록 · 투표자 조회</h2>
        <div className={styles.surveyList}>
          {surveys.length === 0 && <p className={styles.hint}>등록된 설문이 없습니다.</p>}
          {surveys.map((s) => (
            <div key={s.id} className={styles.surveyRow}>
              <button
                type="button"
                className={styles.surveyButton}
                onClick={() => openVoters(s.id)}
              >
                <span className={styles.surveyDate}>{s.executedLabel}</span>
                <span className={styles.surveyMeta}>
                  투표 시작 {s.exposedLabel} · {s.status}
                </span>
                <span className={styles.surveyToggle}>{openId === s.id ? "닫기" : "투표자 보기"}</span>
              </button>

              {openId === s.id && (
                <div className={styles.voterBox}>
                  {isLoading ? (
                    <p className={styles.hint}>불러오는 중...</p>
                  ) : (
                    <>
                      <div className={styles.countRow}>
                        {counts.map((c) => (
                          <span key={c.type} className={styles.countChip}>
                            {VOTING_TYPE_LABEL[c.type]} {c.n}
                          </span>
                        ))}
                        <span className={styles.countChip}>미투표 {nonVoters.length}</span>
                      </div>

                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>순번</th>
                            <th className={styles.th}>가문명</th>
                            <th className={styles.th}>길드</th>
                            <th className={styles.th}>표</th>
                            <th className={styles.th}>직업</th>
                            <th className={styles.th}>투표 시각</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voters.map((v, i) => (
                            <tr key={`${v.nickname}-${i}`}>
                              <td className={styles.tdNum}>{i + 1}</td>
                              <td className={styles.td}>{v.nickname}</td>
                              <td className={styles.td}>{v.guildName}</td>
                              <td className={styles.td}>{VOTING_TYPE_LABEL[v.votingType]}</td>
                              <td className={styles.td}>
                                {v.className
                                  ? `${v.className} (${v.classType ? CLASS_TYPE_LABEL[v.classType] : "?"})`
                                  : "미등록"}
                              </td>
                              <td className={styles.tdTime}>
                                {formatKstTimeWithSeconds(new Date(v.votedAt))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {nonVoters.length > 0 && (
                        <details className={styles.details}>
                          <summary className={styles.summary}>
                            미투표자 {nonVoters.length}명
                          </summary>
                          <p className={styles.nonVoterList}>
                            {nonVoters.map((n) => `${n.nickname}(${n.guildName})`).join(", ")}
                          </p>
                        </details>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
