"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitVote } from "./actions";
import {
  ATTEND_TYPES,
  CLASS_TYPE_LABEL,
  VOTING_TYPE_LABEL,
  type ClassType,
  type VotingType,
} from "@/lib/types";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import styles from "./vote.module.css";

// Order follows the design handoff's 2×2 grid: 참여 / 부속 / 늦참 / 미참.
const BUTTONS: VotingType[] = ["attend", "boarding", "late_attend", "non_attend"];

export function VoteButtons({
  surveyId,
  initialVote,
  initialVotedAt,
  closed,
  initialClassInfo,
}: {
  surveyId: string;
  initialVote: VotingType | null;
  initialVotedAt: Date | null;
  closed: boolean;
  initialClassInfo: { name: string; type: ClassType } | null;
}) {
  const [currentVote, setCurrentVote] = useState<VotingType | null>(initialVote);
  const [votedAt, setVotedAt] = useState<Date | null>(initialVotedAt);
  // Registration now lives on /classes, so this never changes here.
  const classInfo = initialClassInfo;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  /* 서버가 마감이라고 답하면 화면도 즉시 잠근다. 오래 열어둔 탭에서 눌렀을 때
     버튼이 계속 살아 있으면 같은 실패를 반복하게 된다. */
  const [serverClosed, setServerClosed] = useState(false);
  /* 열리기 몇 초 전에 눌렀을 때. 마감과 달리 곧 열리므로 그때까지만 잠근다. */
  const [tooEarly, setTooEarly] = useState(false);
  const earlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (earlyTimer.current) clearTimeout(earlyTimer.current); }, []);

  const isAttend = currentVote ? ATTEND_TYPES.includes(currentVote) : false;
  const votingClosed = closed || serverClosed;

  function handleVote(votingType: VotingType) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitVote(surveyId, votingType);
        if (!result.ok) {
          const waiting = result.opensAt !== null ? result.opensAt - result.serverNow : 0;
          if (waiting > 0) {
            // 몇 초 일찍 눌렀다. 열릴 때까지만 잠그고, 열리면 버튼을 다시 살린다.
            setError(`아직 열리지 않았어요. ${Math.ceil(waiting / 1000)}초 뒤에 열립니다.`);
            setTooEarly(true);
            earlyTimer.current = setTimeout(() => { setTooEarly(false); setError(null); }, waiting);
            return;
          }
          setError(result.message);
          if (result.reason === "closed") setServerClosed(true);
          return;
        }
        const kor = VOTING_TYPE_LABEL[result.vote.votingType];
        setMessage(result.vote.isDuplicated ? `이미 ${kor}를 선택한 상태입니다.` : `${kor} 선택.`);
        setCurrentVote(result.vote.votingType);
        setVotedAt(result.vote.votedAt);
      } catch {
        // 여기까지 오는 것은 네트워크가 끊겼거나 서버가 죽은 경우뿐이다.
        /* 배포가 바뀌어 이 화면의 버튼을 서버가 알아보지 못할 때도 여기로 온다. */
        setError("투표를 보내지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div>
      <div className={styles.buttonRow}>
        {BUTTONS.map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.voteButton} ${currentVote === type ? styles.selected : ""}`}
            disabled={votingClosed || tooEarly || isPending}
            onClick={() => handleVote(type)}
          >
            {VOTING_TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      {currentVote && votedAt && (
        <p className={styles.notice}>
          {formatSurveyDate(votedAt)} {formatSurveyTime(votedAt)}에 투표 완료
        </p>
      )}

      {votingClosed && <p className={styles.notice}>투표가 마감되었습니다.</p>}
      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!votingClosed && isAttend && (
        <div className={styles.classSection}>
          {classInfo ? (
            <p className={styles.notice}>
              현재 직업: {classInfo.name} ({CLASS_TYPE_LABEL[classInfo.type]})
            </p>
          ) : (
            <p className={styles.warning}>
              ⚠️ 직업 미등록! 직업을 등록해야 인원제한결과에 포함됩니다.
            </p>
          )}
          <Link href="/classes" className={styles.classLink}>
            직업 등록 화면 →
          </Link>
        </div>
      )}
    </div>
  );
}
