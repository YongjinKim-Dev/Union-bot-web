"use client";

import { useState, useTransition } from "react";
import { submitVote } from "./actions";
import { ClassSelector } from "./ClassSelector";
import {
  ATTEND_TYPES,
  CLASS_TYPE_LABEL,
  VOTING_TYPE_LABEL,
  type ClassType,
  type VotingType,
} from "@/lib/types";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import styles from "./vote.module.css";

const BUTTONS: { type: VotingType; className: string }[] = [
  { type: "attend", className: styles.primary },
  { type: "non_attend", className: styles.grey },
  { type: "boarding", className: styles.green },
  { type: "late_attend", className: styles.danger },
];

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
  const [classInfo, setClassInfo] = useState(initialClassInfo);
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
        {BUTTONS.map(({ type, className }) => (
          <button
            key={type}
            type="button"
            className={`${styles.voteButton} ${className} ${currentVote === type ? styles.selected : ""}`}
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
              <br />
              직업을 변경하시려면 아래에서 다시 선택해주세요.
            </p>
          ) : (
            <p className={styles.warning}>
              ⚠️ 직업 미등록! 아래에서 직업을 등록해야 인원제한결과에 포함됩니다.
            </p>
          )}
          <ClassSelector
            initialType={classInfo?.type}
            initialName={classInfo?.name}
            onSelected={(name, type) => setClassInfo({ name, type })}
          />
        </div>
      )}
    </div>
  );
}
