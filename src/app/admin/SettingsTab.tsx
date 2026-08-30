"use client";

import { useState, useTransition } from "react";
import { formatSurveyDate, formatSurveyTime, getVotingClosesAt } from "@/lib/format";
import type { AutoRule } from "@/lib/settings";
import type { DbSurvey } from "@/lib/types";
import type { Phase } from "./AdminConsole";
import styles from "./admin.module.css";
import { DAYS, type Dow } from "./adminData";
import { DEFAULT_RULE } from "./adminMock";
import { addManualSurveyAction, cancelSurveyAction, closeSurveyAction, saveAutoRuleAction } from "./settingsActions";

/* 요일 이름과 getDay() 숫자(0=일 … 6=토) 사이 변환 */
const DOW_NUM: Record<Dow, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

function daysFromRule(rule: AutoRule): Record<Dow, boolean> {
  const on = new Set(rule.weekdays);
  return Object.fromEntries(DAYS.map((d) => [d, on.has(DOW_NUM[d])])) as Record<Dow, boolean>;
}

interface SettingsTabProps {
  current: DbSurvey | null;
  queue: DbSurvey[];
  autoRule: AutoRule;
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

export function SettingsTab({ current, queue, autoRule, phase, showToast }: SettingsTabProps) {
  const [recurDays, setRecurDays] = useState<Record<Dow, boolean>>(() => daysFromRule(autoRule));
  const [battleTime, setBattleTime] = useState(autoRule.battleTime);
  const [openTime, setOpenTime] = useState(autoRule.openTime);
  const [announceMin, setAnnounceMin] = useState(String(autoRule.announceMinutes));
  const [announceText, setAnnounceText] = useState(autoRule.announceText);
  const [isSaving, startSave] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [qDate, setQDate] = useState("");
  const [qBattle, setQBattle] = useState(DEFAULT_RULE.battle);
  const [qOpenDate, setQOpenDate] = useState("");
  const [qOpen, setQOpen] = useState(DEFAULT_RULE.open);
  const [qAnnounceMin, setQAnnounceMin] = useState(String(DEFAULT_RULE.announceMinutes));
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
            <h3 className={styles.cardTitle}>자동 등록</h3>
            <span className={styles.label}>진행 요일</span>
            <div className={styles.recur}>
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.rDay} ${recurDays[d] ? styles.rDayOn : ""}`}
                  onClick={() => setRecurDays((prev) => ({ ...prev, [d]: !prev[d] }))}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>거점전 시각</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="time"
                  value={battleTime}
                  onChange={(e) => setBattleTime(e.target.value || DEFAULT_RULE.battle)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>투표 오픈 (전날)</span>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value || DEFAULT_RULE.open)}
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
                  value={announceMin}
                  onChange={(e) => setAnnounceMin(e.target.value)}
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
                  value={announceText}
                  onChange={(e) => setAnnounceText(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.cardAct}>
              <button
                type="button"
                className={styles.btnSm}
                onClick={() => {
                  setRecurDays(daysFromRule(autoRule));
                  setBattleTime(autoRule.battleTime);
                  setOpenTime(autoRule.openTime);
                  setAnnounceMin(String(autoRule.announceMinutes));
                  setAnnounceText(autoRule.announceText);
                  showToast("저장 전 상태로 되돌렸습니다");
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnPrimary}`}
                disabled={isSaving}
                onClick={() => {
                  startSave(async () => {
                    try {
                      await saveAutoRuleAction({
                        weekdays: DAYS.filter((d) => recurDays[d]).map((d) => DOW_NUM[d]),
                        battleTime,
                        openTime,
                        announceMinutes: Number(announceMin) || 0,
                        announceText,
                      });
                      showToast("자동 등록 규칙이 저장되었습니다 · 큐에 반영됨");
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : "저장에 실패했습니다");
                    }
                  });
                }}
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mainCol}>
          <div className={styles.card}>
            <div className={styles.titleRow}>
              <h3 className={styles.cardTitle}>예정된 투표 큐</h3>
              <button type="button" className={styles.btnSm} onClick={() => setFormOpen((v) => !v)}>
                수동 추가
              </button>
            </div>

            {formOpen && (
              <div className={styles.qForm}>
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
                      rows={3}
                      placeholder="비워두면 날짜, 투표 시각, 링크가 들어간 기본 문구로 나갑니다"
                      value={qAnnounceText}
                      onChange={(e) => setQAnnounceText(e.target.value)}
                    />
                  </label>
                </div>
                <div className={styles.cardAct}>
                  <button type="button" className={styles.btnSm} onClick={() => setFormOpen(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnSm} ${styles.btnPrimary}`}
                    disabled={isQueueBusy}
                    onClick={() => {
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
                          setFormOpen(false);
                          showToast("수동 회차를 큐에 추가했습니다");
                        } catch (e) {
                          showToast(e instanceof Error ? e.message : "등록에 실패했습니다");
                        }
                      });
                    }}
                  >
                    {isQueueBusy ? "추가 중..." : "추가"}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.qList}>
              {queue.length === 0 && (
                <div className={styles.qEmpty}>예정된 회차가 없습니다. 진행 요일을 켜거나 회차를 추가하세요</div>
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
                          showToast("이 회차를 뺐습니다 · 반복 규칙은 유지");
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
