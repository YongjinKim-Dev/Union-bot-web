"use client";

import { useEffect, useRef, useState } from "react";
import { VoteButtons } from "./VoteButtons";
import { maybeAnnounce } from "./announceAction";
import { useServerClockOffset } from "@/lib/serverClock";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import type { ClassType, VotingType } from "@/lib/types";
import styles from "./vote.module.css";

function splitDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 카운트다운과 투표 화면을 한 컴포넌트에서 처리한다.
 *
 * 예전에는 봇이 status 를 바꿔주기를 5초 폴링으로 기다렸다. 그래서 열리는 순간이
 * 사람마다 최대 35초까지 어긋났고, 순번이 뒤틀렸다. 이제 설문 데이터를 미리 다
 * 받아두고 서버 시각이 opensAt 에 닿는 순간 이 자리에서 바로 투표 화면으로
 * 바꾼다. 서버 왕복도, 봇도 개입하지 않으므로 모두 같은 순간에 열린다.
 */
export function CurrentSurveyPanel({
  surveyId,
  opensAt,
  executedAt,
  closesAt,
  initialVote,
  initialVotedAt,
  initialClassInfo,
  announceAt,
}: {
  surveyId: string;
  opensAt: number;
  executedAt: number;
  closesAt: number;
  initialVote: VotingType | null;
  initialVotedAt: Date | null;
  initialClassInfo: { name: string; type: ClassType } | null;
  /** 공지를 쏠 시각(ms). 이미 보냈거나 공지가 없으면 null. */
  announceAt: number | null;
}) {
  const offset = useServerClockOffset();
  const [serverNow, setServerNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setServerNow(Date.now() + offset);
    tick();
    // 카운트다운이 도는 동안은 촘촘하게 확인해 0 을 넘기는 순간을 놓치지 않는다.
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [offset]);

  // 보이지 않는 두 번째 카운트다운. 공지 시각에 닿으면 서버에 한 번만 알린다.
  // 이 탭이 두 번 부르지 않게만 막으면 되고 화면과는 무관하므로 ref 를 쓴다.
  // 여러 사람의 탭이 동시에 불러도 실제 발송은 DB 선점으로 하나만 나간다.
  const announceFired = useRef(false);
  useEffect(() => {
    if (announceAt === null || announceFired.current) return;
    if (serverNow < announceAt) return;
    announceFired.current = true;
    void maybeAnnounce();
  }, [serverNow, announceAt]);

  const remaining = Math.max(0, opensAt - serverNow);
  const isOpen = serverNow >= opensAt;
  const isClosed = serverNow >= closesAt;

  if (isOpen) {
    return (
      <>
        <h1 className={styles.title}>거점전 설문조사</h1>
        <p className={styles.dateLine}>
          거점 일시 {formatSurveyDate(new Date(executedAt))} {formatSurveyTime(new Date(executedAt))}
        </p>
        <p className={styles.instruction}>
          선택지는 하나만 선택해주세요. (부속인 경우 부속만 선택)
        </p>
        <VoteButtons
          surveyId={surveyId}
          initialVote={initialVote}
          initialVotedAt={initialVotedAt}
          closed={isClosed}
          initialClassInfo={initialClassInfo}
        />
      </>
    );
  }

  const { days, hours, minutes, seconds } = splitDuration(remaining);

  return (
    <>
      <h1 className={styles.title}>거점전 설문조사</h1>
      <p className={styles.dateLine}>
        거점 일시 {formatSurveyDate(new Date(executedAt))} {formatSurveyTime(new Date(executedAt))}
      </p>
      <p className={styles.instruction}>
        투표는 {formatSurveyTime(new Date(opensAt))}에 열립니다. 모두 같은 시각에 열리며, 이 화면이
        그대로 투표 화면으로 바뀝니다.
      </p>
      <div className={styles.countdown}>
        {days > 0 && <span className={styles.countdownSegment}>{days}일</span>}
        <span className={styles.countdownSegment}>
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
    </>
  );
}
