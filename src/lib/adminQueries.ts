import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import type { DbSurvey } from "@/lib/types";

/* 관리자 화면 전용 조회 */

/*
 * 관리자가 조정 중인 명단을 담는 임시 테이블.
 * survey_history와 형식이 같고, 조정한 순서를 기억하기 위한 position 컬럼만 추가했다.
 */
export async function ensureDraftTable(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS survey_history_draft (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "voting_type varchar(16) NOT NULL, " +
      "survey_id bigint NOT NULL, " +
      "user_id bigint NOT NULL, " +
      "position int NOT NULL, " +
      "created_at datetime NOT NULL, " +
      "updated_at datetime NOT NULL, " +
      "PRIMARY KEY (id), " +
      "UNIQUE KEY uq_survey_user (survey_id, user_id))",
  );
}

/*
 * 오늘 투표 회차와 그 뒤 예정 큐.
 * 투표 페이지와 달리 거점전 시각이 지날 때까지 회차를 물고 있는다.
 * 마감 뒤 순번 조정과 발표를 여기서 해야 하기 때문이다.
 */
export async function getScheduleOverview(
  now: Date = new Date(),
): Promise<{ current: DbSurvey | null; queue: DbSurvey[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, announce_at, announce_content, discord_message_id " +
      "FROM survey WHERE status <> 'cancel' AND executed_at > ? " +
      "ORDER BY executed_at ASC, exposed_at ASC, id ASC",
    [now],
  );
  const list = rows as DbSurvey[];
  const opened = list
    .filter((s) => s.exposed_at <= now)
    .sort(
      (a, b) =>
        b.exposed_at.getTime() - a.exposed_at.getTime() || Number(b.id) - Number(a.id),
    );
  const future = list
    .filter((s) => s.exposed_at > now)
    .sort(
      (a, b) =>
        a.exposed_at.getTime() - b.exposed_at.getTime() || Number(b.id) - Number(a.id),
    );

  // 열린 회차가 있으면 가장 최근에 열린 것이 오늘 투표,
  // 없으면 가장 가까운 미래 회차를 대기 상태로 보여준다.
  if (opened.length > 0) return { current: opened[0], queue: future };
  if (future.length === 0) return { current: null, queue: [] };
  return { current: future[0], queue: future.slice(1) };
}

export interface PastSurveyRow {
  id: string;
  executed_at: Date;
  exposed_at: Date;
  counts: { 참여: number; 부속: number; 늦참: number; 미참: number };
}

/*
 * 지난 회차 목록. 운영 화면(오늘 투표와 큐)이 보여주지 않는 회차가 지난 투표다.
 * 그래서 새 투표가 열려 앞 회차가 밀려나는 순간 그 회차는 바로 여기에 나타난다.
 */
export async function getPastSurveys(
  page: number,
  size: number,
  now: Date = new Date(),
): Promise<{ rows: PastSurveyRow[]; total: number }> {
  const offset = (page - 1) * size;
  const { current, queue } = await getScheduleOverview(now);
  const activeIds = [current, ...queue].filter((s) => s !== null).map((s) => s.id);
  const exclude = activeIds.length > 0 ? `AND s.id NOT IN (${activeIds.map(() => "?").join(",")})` : "";
  const excludeCount = activeIds.length > 0 ? `AND id NOT IN (${activeIds.map(() => "?").join(",")})` : "";

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM survey WHERE status <> 'cancel' ${excludeCount}`,
    activeIds,
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT s.id, s.executed_at, s.exposed_at, " +
      "SUM(h.voting_type = 'attend') AS a, SUM(h.voting_type = 'boarding') AS b, " +
      "SUM(h.voting_type = 'late_attend') AS l, SUM(h.voting_type = 'non_attend') AS n " +
      "FROM survey s LEFT JOIN survey_history h ON h.survey_id = s.id " +
      `WHERE s.status <> 'cancel' ${exclude} ` +
      "GROUP BY s.id, s.executed_at, s.exposed_at " +
      `ORDER BY s.executed_at DESC, s.id DESC LIMIT ${Number(size)} OFFSET ${Number(offset)}`,
    activeIds,
  );
  return {
    total: Number(countRows[0].c),
    rows: rows.map((r) => ({
      id: String(r.id),
      executed_at: r.executed_at as Date,
      exposed_at: r.exposed_at as Date,
      counts: {
        참여: Number(r.a ?? 0),
        부속: Number(r.b ?? 0),
        늦참: Number(r.l ?? 0),
        미참: Number(r.n ?? 0),
      },
    })),
  };
}
