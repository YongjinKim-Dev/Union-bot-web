"use client";

import { useState, useTransition } from "react";
import { formatSurveyDate, formatSurveyTime, getVotingClosesAt } from "@/lib/format";
import type { DbSurvey } from "@/lib/types";
import type { Phase } from "./AdminConsole";
import styles from "./admin.module.css";
import { addManualSurveyAction, cancelSurveyAction, closeSurveyAction } from "./settingsActions";

/* 등록 폼 초기값. 연맹의 평소 일정이다. */
const DEFAULT_BATTLE_TIME = "21:00";
const DEFAULT_OPEN_TIME = "22:30";
const DEFAULT_ANNOUNCE_MIN = "15";

interface SettingsTabProps {
  current: DbSurvey | null;
  queue: DbSurvey[];
  phase: Phase;
  showToast: (text: string) => void;
}

function battleLabel(s: DbSurvey) {
  return `${formatSurveyDate(s.executed_at)} ${formatSurveyTime(s.executed_at)}`;
}

function closeLabel(s: DbSurvey) {
  const closeAt = getVotingClosesAt(s.executed_at);
  return `${formatSurveyDate(closeAt)} ${formatSurveyTime(closeAt)}`;
}

function announceLabel(s: DbSurvey) {
  if (!s.announce_at) return "공지 안 함";
  const minutes = Math.round((s.exposed_at.getTime() - s.announce_at.getTime()) / 60000);
  return `공지 ${minutes}분 전`;
}

export function SettingsTab({ current, queue, phase, showToast }: SettingsTabProps) {
  const [qDate, setQDate] = useState("");
  const [qBattle, setQBattle] = useState(DEFAULT_BATTLE_TIME);
  const [qOpenDate, setQOpenDate] = useState("");
  const [qOpen, setQOpen] = useState(DEFAULT_OPEN_TIME);
  const [qAnnounceMin, setQAnnounceMin] = useState(DEFAULT_ANNOUNCE_MIN);
  const [qAnnounceText, setQAnnounceText] = useState("");
  const [isQueueBusy, startQueueWork] = useTransition();

  const waiting = phase === "waiting";
  const closed = phase === "closed";

  // 투표는 보통 거점전 전날 열리므로 거점전 날짜를 고르면 오픈 날짜를 전날로 채워 준다
  function pickBattleDate(iso: string) {
    setQDate(iso);
    if (!iso) return;
    const [y, m, d] = iso.split("-").map(Number);
    const prev = new Date(y, m - 1, d - 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    setQOpenDate(`${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`);
  }

  function register() {
    if (!qDate || !qOpenDate) {
      showToast("날짜를 먼저 입력해 주세요");
      return;
    }
    startQueueWork(async () => {
      try {
        await addManualSurveyAction({
          executedAt: `${qDate}T${qBattle}`,
          exposedAt: `${qOpenDate}T${qOpen}`,
          announceMinutesBefore: Number(qAnnounceMin) || 0,
          announceContent: qAnnounceText,
        });
        setQDate("");
        setQOpenDate("");
        setQAnnounceText("");
        showToast("회차를 큐에 등록했습니다");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "등록에 실패했습니다");
      }
    });
  }

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>투표 일정 관리</h2>
      <div className={styles.split}>
        <div className={styles.side}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{waiting ? "다음 투표" : "오늘 투표"}</h3>
            <div className={styles.liveLine}>
              <i className={`${styles.dot} ${phase === "live" ? `${styles.dotLive} ${styles.pulse}` : ""}`} />
              {waiting ? "다음 투표 대기" : closed ? "마감됨" : "라이브 · 투표 집계 중"}
            </div>
            {current ? (
              <>
                <div className={styles.todayMeta}>
                  <span>거점전</span>
                  <b>{battleLabel(current)}</b>
                </div>
                {waiting && (
                  <div className={styles.todayMeta}>
                    <span>투표 오픈</span>
                    <b>
                      {formatSurveyDate(current.exposed_at)} {formatSurveyTime(current.exposed_at)}
                    </b>
                  </div>
                )}
                <div className={styles.todayMeta}>
                  <span>투표 마감</span>
                  <b>{closeLabel(current)}</b>
                </div>
              </>
            ) : (
              <div className={styles.todayMeta}>
                <span>예정</span>
                <b>등록된 회차 없음</b>
              </div>
            )}
            <button
              type="button"
              className={`${styles.btnSm} ${styles.block} ${styles.closeBtn} ${phase === "live" ? styles.btnPrimary : ""}`}
              disabled={phase !== "live" || isQueueBusy}
              onClick={() => {
                if (!current) return;
                startQueueWork(async () => {
                  try {
                    await closeSurveyAction(current.id);
                    showToast("오늘 투표를 즉시 마감했습니다");
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : "마감에 실패했습니다");
                  }
                });
              }}
            >
              {closed ? "마감됨" : "즉시 마감"}
            </button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>투표 등록</h3>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>거점전 날짜</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="date"
                  value={qDate}
                  onChange={(e) => pickBattleDate(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>거점전 시각</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="time"
                  value={qBattle}
                  onChange={(e) => setQBattle(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>투표 오픈 날짜</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="date"
                  value={qOpenDate}
                  onChange={(e) => setQOpenDate(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>투표 오픈 시각</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="time"
                  value={qOpen}
                  onChange={(e) => setQOpen(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>디코 공지 (오픈 몇 분 전, 0이면 안 함)</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="number"
                  min={0}
                  value={qAnnounceMin}
                  onChange={(e) => setQAnnounceMin(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>공지 문구 (비우면 기본 문구)</span>
                <textarea
                  className={`${styles.input} ${styles.announceText}`}
                  rows={2}
                  placeholder="비워두면 날짜, 투표 시각, 링크가 들어간 기본 문구로 나갑니다"
                  value={qAnnounceText}
                  onChange={(e) => setQAnnounceText(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.cardAct}>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnPrimary}`}
                onClick={register}
                disabled={isQueueBusy}
              >
                {isQueueBusy ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mainCol}>
          <div className={styles.card}>
            <div className={styles.titleRow}>
              <h3 className={styles.cardTitle}>예정된 투표 큐</h3>
            </div>

            <div className={styles.qList}>
              {queue.length === 0 && (
                <div className={styles.qEmpty}>예정된 회차가 없습니다. 왼쪽에서 회차를 등록하세요</div>
              )}
              {queue.map((s) => (
                <div key={s.id} className={styles.qRow}>
                  <span className={styles.sCol}>
                    <span className={styles.sTitle}>{battleLabel(s)}</span>
                    <span className={styles.sSub}>
                      투표 오픈 {formatSurveyDate(s.exposed_at)} {formatSurveyTime(s.exposed_at)} · {announceLabel(s)}
                    </span>
                  </span>
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={styles.btnXs}
                    disabled={isQueueBusy}
                    onClick={() => {
                      startQueueWork(async () => {
                        try {
                          await cancelSurveyAction(s.id);
                          showToast("이 회차를 뺐습니다");
                        } catch (e) {
                          showToast(e instanceof Error ? e.message : "빼기에 실패했습니다");
                        }
                      });
                    }}
                  >
                    빼기
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
