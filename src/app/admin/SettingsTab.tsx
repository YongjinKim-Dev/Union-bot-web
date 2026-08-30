"use client";

import { useRef, useState } from "react";
import styles from "./admin.module.css";
import { DAYS, type Dow, type ManualRound, buildQueue, closeOf, dowOf, isoOf, parseIso } from "./adminData";
import { DEFAULT_RULE, NEXT_SURVEY, QUEUE_DAYS, QUEUE_FROM, SURVEYS } from "./adminMock";

interface SettingsTabProps {
  showToast: (text: string) => void;
  closed: boolean;
  /* 거점전이 끝나고 다음 투표가 열리기 전까지의 대기 국면 */
  waiting: boolean;
  onClose: () => void;
}

export function SettingsTab({ showToast, closed, waiting, onClose }: SettingsTabProps) {
  const [recurDays, setRecurDays] = useState<Record<Dow, boolean>>({ ...DEFAULT_RULE.days });
  const [battleTime, setBattleTime] = useState(DEFAULT_RULE.battle);
  const [openTime, setOpenTime] = useState(DEFAULT_RULE.open);
  const [announceMin, setAnnounceMin] = useState(String(DEFAULT_RULE.announceMinutes));
  const [announceText, setAnnounceText] = useState(DEFAULT_RULE.announceText);
  // 취소를 누르면 마지막으로 저장한 규칙으로 되돌린다
  const savedRule = useRef({
    days: { ...DEFAULT_RULE.days },
    battle: DEFAULT_RULE.battle,
    open: DEFAULT_RULE.open,
    announceMin: String(DEFAULT_RULE.announceMinutes),
    announceText: DEFAULT_RULE.announceText,
  });

  const [manualRounds, setManualRounds] = useState<ManualRound[]>([]);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [qDate, setQDate] = useState("");
  const [qBattle, setQBattle] = useState(DEFAULT_RULE.battle);
  const [qOpenDate, setQOpenDate] = useState("");
  const [qOpen, setQOpen] = useState(DEFAULT_RULE.open);
  const [qAnnounceMin, setQAnnounceMin] = useState(String(DEFAULT_RULE.announceMinutes));
  const [qAnnounceText, setQAnnounceText] = useState("");

  const seqRef = useRef(0);

  const queue = buildQueue(recurDays, battleTime, openTime, Number(announceMin) || 0, manualRounds, QUEUE_FROM, QUEUE_DAYS);

  // 투표는 보통 거점전 전날 열리므로 거점전 날짜를 고르면 오픈 날짜를 전날로 채워 준다
  function pickBattleDate(iso: string) {
    setQDate(iso);
    if (!iso) return;
    const prev = parseIso(iso);
    prev.setDate(prev.getDate() - 1);
    setQOpenDate(isoOf(prev));
  }

  function addManualRound() {
    if (!qDate) {
      showToast("날짜를 먼저 입력해 주세요");
      return;
    }
    seqRef.current += 1;
    setManualRounds((prev) => [
      ...prev,
      {
        id: `q-${seqRef.current}`,
        iso: qDate,
        battle: qBattle || DEFAULT_RULE.battle,
        openIso: qOpenDate || qDate,
        open: qOpen || DEFAULT_RULE.open,
        announceMin: Number(qAnnounceMin) || 0,
      },
    ]);
    setQDate("");
    setQOpenDate("");
    setQAnnounceText("");
    setFormOpen(false);
    showToast("수동 회차를 큐에 추가했습니다");
  }

  function removeRound(key: string) {
    setSkipped((prev) => ({ ...prev, [key]: true }));
    showToast("이 회차를 뺐습니다 · 반복 규칙은 유지");
  }

  // 대기 국면에는 다음 회차와 그 오픈 시점(거점전 전날 22:30)을 보여준다
  const today = waiting ? NEXT_SURVEY : SURVEYS[0];
  const openDay = parseIso(today.iso);
  openDay.setDate(openDay.getDate() - 1);

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>투표 일정 관리</h2>
      <div className={styles.split}>
        <div className={styles.side}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{waiting ? "다음 투표" : "오늘 투표"}</h3>
            <div className={styles.liveLine}>
              <i className={`${styles.dot} ${closed || waiting ? "" : `${styles.dotLive} ${styles.pulse}`}`} />
              {waiting ? "다음 투표 대기" : closed ? "마감됨" : "라이브 · 투표 집계 중"}
            </div>
            <div className={styles.todayMeta}>
              <span>거점전</span>
              <b>
                {today.key} ({today.dow}) {today.battle}
              </b>
            </div>
            {waiting && (
              <div className={styles.todayMeta}>
                <span>투표 오픈</span>
                <b>
                  {isoOf(openDay).slice(5).replace("-", ".")} ({dowOf(openDay)}) {today.open}
                </b>
              </div>
            )}
            <div className={styles.todayMeta}>
              <span>투표 마감</span>
              <b>
                {today.key} ({today.dow}) {closeOf(today.battle)}
              </b>
            </div>
            <button
              type="button"
              className={`${styles.btnSm} ${styles.block} ${styles.closeBtn} ${closed || waiting ? "" : styles.btnPrimary}`}
              disabled={closed || waiting}
              onClick={() => {
                onClose();
                showToast("오늘 투표를 즉시 마감했습니다");
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
                  const base = savedRule.current;
                  setRecurDays({ ...base.days });
                  setBattleTime(base.battle);
                  setOpenTime(base.open);
                  setAnnounceMin(base.announceMin);
                  setAnnounceText(base.announceText);
                  showToast("저장 전 상태로 되돌렸습니다");
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.btnSm} ${styles.btnPrimary}`}
                onClick={() => {
                  savedRule.current = {
                    days: { ...recurDays },
                    battle: battleTime,
                    open: openTime,
                    announceMin,
                    announceText,
                  };
                  showToast("자동 등록 규칙이 저장되었습니다");
                }}
              >
                저장
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
                  <button type="button" className={`${styles.btnSm} ${styles.btnPrimary}`} onClick={addManualRound}>
                    추가
                  </button>
                </div>
              </div>
            )}

            <div className={styles.qList}>
              {queue.length === 0 && (
                <div className={styles.qEmpty}>예정된 회차가 없습니다. 진행 요일을 켜거나 회차를 추가하세요</div>
              )}
              {queue
                .filter((r) => !skipped[r.key])
                .map((r) => (
                  <div key={r.key} className={styles.qRow}>
                    <span className={styles.sCol}>
                      <span className={styles.sTitle}>
                        {r.iso} ({r.dow}) {r.battle}
                      </span>
                      <span className={styles.sSub}>
                        투표 오픈 {r.openIso} ({r.openDow}) {r.open} ·{" "}
                        {r.announceMin > 0 ? `공지 ${r.announceMin}분 전` : "공지 안 함"}
                      </span>
                    </span>
                    <span className={styles.spacer} />
                    <span className={`${styles.qBadge} ${r.src === "수동" ? styles.qBadgeManual : ""}`}>{r.src}</span>
                    <button type="button" className={styles.btnXs} onClick={() => removeRound(r.key)}>
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
