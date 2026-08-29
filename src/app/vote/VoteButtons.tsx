"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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

  const isAttend = currentVote ? ATTEND_TYPES.includes(currentVote) : false;

  function handleVote(votingType: VotingType) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitVote(surveyId, votingType);
        const kor = VOTING_TYPE_LABEL[result.votingType];
        setMessage(result.isDuplicated ? `이미 ${kor}를 선택한 상태입니다.` : `${kor} 선택.`);
        setCurrentVote(result.votingType);
        setVotedAt(result.votedAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : "투표 처리 중 오류가 발생했습니다.");
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
            disabled={closed || isPending}
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

      {closed && <p className={styles.notice}>투표가 마감되었습니다.</p>}
      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!closed && isAttend && (
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
