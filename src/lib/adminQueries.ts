import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import type { DbSurvey } from "@/lib/types";

/* 관리자 화면 전용 조회 */

/* 결과 발송 시각을 담는 컬럼. 서버 시작 때 없으면 만든다. */
export async function ensureResultSentColumn(): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS " +
      "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey' AND COLUMN_NAME = 'result_sent_at'",
  );
  if (Number(rows[0].c) === 0) {
    try {
      await pool.execute("ALTER TABLE survey ADD COLUMN result_sent_at DATETIME NULL");
    } catch (error) {
      // 여러 서버가 동시에 시작하면 둘 다 위 조회를 통과할 수 있다.
      if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
}

/*
 * 오늘 투표 회차와 그 뒤 예정 큐.
 * 투표 페이지와 달리 거점전 시각이 지날 때까지 회차를 물고 있는다.
 * 마감 뒤 순번 조정과 발표를 여기서 해야 하기 때문이다.
 * 단, 결과를 보낸 뒤 다음 회차 투표가 열리면 그쪽으로 넘어간다.
 */
export async function getScheduleOverview(
  now: Date = new Date(),
): Promise<{ current: DbSurvey | null; queue: DbSurvey[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, announce_at, announce_content, discord_message_id, result_sent_at " +
      "FROM survey WHERE status <> 'cancel' AND executed_at > ? ORDER BY executed_at ASC",
    [now],
  );
  const list = rows as DbSurvey[];
  // 다음 회차 투표가 열려 있어도, 앞 회차는 결과를 디코로 보낸 뒤에만 자리를 내준다.
  // 발송을 안 하면 거점전 시각이 지날 때 넘어간다 (조회 조건에서 빠지므로).
  let idx = 0;
  for (let i = 1; i < list.length; i += 1) {
    if (list[idx].result_sent_at && list[i].exposed_at <= now) idx = i;
  }
  return { current: list[idx] ?? null, queue: list.slice(idx + 1) };
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
      `ORDER BY s.executed_at DESC LIMIT ${Number(size)} OFFSET ${Number(offset)}`,
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
