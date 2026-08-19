import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import { VOTING_TYPE_LABEL, type DbSurvey, type VotingType } from "@/lib/types";
import styles from "./vote.module.css";

const SUMMARY_ORDER: VotingType[] = ["attend", "boarding", "non_attend", "late_attend"];

export function PastSurveySummary({
  survey,
  counts,
}: {
  survey: DbSurvey;
  counts: Record<VotingType, number>;
}) {
  const total = SUMMARY_ORDER.reduce((sum, type) => sum + counts[type], 0);

  return (
    <div>
      <h1 className={styles.title}>거점전 설문조사 (지난 설문)</h1>
      <p className={styles.dateLine}>
        거점 일시 {formatSurveyDate(survey.executed_at)} {formatSurveyTime(survey.executed_at)}
      </p>
      <ul className={styles.summaryList}>
        {SUMMARY_ORDER.map((type) => (
          <li key={type} className={styles.summaryItem}>
            <span>{VOTING_TYPE_LABEL[type]}</span>
            <span>{counts[type]}명</span>
          </li>
        ))}
      </ul>
      <p className={styles.notice}>총 투표 {total}명</p>
    </div>
  );
}
