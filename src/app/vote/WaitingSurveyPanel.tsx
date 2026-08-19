"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import type { DbSurvey } from "@/lib/types";
import styles from "./vote.module.css";

// The bot's check_sendable_survey loop (ashi_bot.py) polls every 30s and
// posts once exposed_at has passed, so exposed_at + 30s is the latest the
// survey can actually go live.
const REVEAL_BUFFER_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;

function getRemainingMs(targetMs: number) {
  return Math.max(0, targetMs - Date.now());
}

function splitDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function WaitingSurveyPanel({ survey }: { survey: DbSurvey }) {
  const router = useRouter();
  const targetMs = survey.exposed_at.getTime() + REVEAL_BUFFER_MS;
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(targetMs));

  useEffect(() => {
    const tick = () => setRemainingMs(getRemainingMs(targetMs));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  useEffect(() => {
    // Re-fetches this server component's data; once the bot flips the
    // survey's status to 'process', VoteTabs (fed by the refreshed props)
    // auto-switches to the 진행중 tab.
    const poll = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [router]);

  const isImminent = remainingMs <= 0;
  const { days, hours, minutes, seconds } = splitDuration(remainingMs);

  return (
    <div>
      <h1 className={styles.title}>거점전 설문조사 (대기중)</h1>
      <p className={styles.dateLine}>
        거점 일시 {formatSurveyDate(survey.executed_at)} {formatSurveyTime(survey.executed_at)}
      </p>
      <p className={styles.instruction}>설문이 공개되면 자동으로 진행중 탭으로 전환됩니다.</p>

      {isImminent ? (
        <p className={styles.countdownSoon}>곧 설문이 열립니다...</p>
      ) : (
        <div className={styles.countdown}>
          {days > 0 && <span className={styles.countdownSegment}>{days}일</span>}
          <span className={styles.countdownSegment}>
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </span>
        </div>
      )}
    </div>
  );
}
