import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { ClassType, DbSurvey, VotingType } from "@/lib/types";
import type { VoterRow } from "@/lib/queries";

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
 * survey_history의 변화를 draft에 반영한다. 원본은 읽기만 한다.
 * draft에 없는 유저의 표는 새 표이므로 투표순으로 맨 뒤에 붙인다.
 * 관리자가 뺀 사람은 행이 남아 있어서(순번 0) 새 표와 섞이지 않는다.
 */
async function syncDraft(surveyId: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await runSyncQueries(connection, surveyId);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runSyncQueries(connection: PoolConnection, surveyId: string): Promise<void> {
  // 명단 밖(미참·늦참)에 있다가 참여·부속으로 돌아온 사람은 지웠다가 새 표처럼 맨 뒤에 다시 붙인다
  await connection.execute(
    "DELETE d FROM survey_history_draft d " +
      "JOIN survey_history h ON h.survey_id = d.survey_id AND h.user_id = d.user_id " +
      "WHERE d.survey_id = ? AND d.position > 0 " +
      "AND d.voting_type NOT IN ('attend', 'boarding') AND h.voting_type IN ('attend', 'boarding')",
    [surveyId],
  );
  await connection.execute(
    "INSERT INTO survey_history_draft (voting_type, survey_id, user_id, position, created_at, updated_at) " +
      "SELECT h.voting_type, h.survey_id, h.user_id, " +
      "       (SELECT COALESCE(MAX(position), 0) FROM (SELECT position FROM survey_history_draft WHERE survey_id = ?) base) " +
      "         + ROW_NUMBER() OVER (ORDER BY h.updated_at ASC, h.id ASC), h.created_at, h.updated_at " +
      "FROM survey_history h " +
      "WHERE h.survey_id = ? AND h.user_id NOT IN " +
      "  (SELECT user_id FROM (SELECT user_id FROM survey_history_draft WHERE survey_id = ?) existing)",
    [surveyId, surveyId, surveyId],
  );
  // 그 밖의 표 종류 변화(참여-부속 전환, 미참 전환 등)는 자리를 그대로 두고 종류와 시각만 맞춘다
  await connection.execute(
    "UPDATE survey_history_draft d " +
      "JOIN survey_history h ON h.survey_id = d.survey_id AND h.user_id = d.user_id " +
      "SET d.voting_type = h.voting_type, d.updated_at = h.updated_at " +
      "WHERE d.survey_id = ? AND (d.voting_type <> h.voting_type OR d.updated_at <> h.updated_at)",
    [surveyId],
  );
}

/*
 * 거점전 시각이 지난 회차의 draft를 survey_history에 반영한다.
 * 그 회차 원본을 비우고 draft를 position 순서대로 통째로 다시 넣는다.
 * 시각은 그대로 옮기고, 넣은 순서가 곧 최종 순번이 된다. 반영한 draft는 지운다.
 */
export async function flushExpiredDrafts(now: Date = new Date()): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT d.survey_id FROM survey_history_draft d " +
      "JOIN survey s ON s.id = d.survey_id WHERE s.executed_at <= ?",
    [now],
  );
  for (const row of rows) {
    const surveyId = String(row.survey_id);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await runSyncQueries(connection, surveyId);
      await connection.execute("DELETE FROM survey_history WHERE survey_id = ?", [surveyId]);
      await connection.execute(
        "INSERT INTO survey_history (voting_type, survey_id, user_id, created_at, updated_at) " +
          "SELECT voting_type, survey_id, user_id, created_at, updated_at " +
          "FROM survey_history_draft WHERE survey_id = ? AND position > 0 ORDER BY position ASC, id ASC",
        [surveyId],
      );
      await connection.execute("DELETE FROM survey_history_draft WHERE survey_id = ?", [surveyId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

/* 관리자 명단. draft를 최신으로 맞춘 뒤 position 순서로 돌려준다. 식별자도 draft의 id다. */
export async function getDraftVoters(surveyId: string): Promise<VoterRow[]> {
  await syncDraft(surveyId);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT d.id AS draft_id, u.user_nickname, g.name AS guild_name, d.voting_type, d.updated_at, d.created_at, " +
      "       cc.name AS class_name, cc.type AS class_type " +
      "FROM survey_history_draft d " +
      "JOIN user u ON d.user_id = u.id " +
      "JOIN guild g ON u.guild_id = g.id " +
      "LEFT JOIN user_character_class_map m ON u.id = m.user_id " +
      "LEFT JOIN character_class cc ON m.character_class_id = cc.id " +
      "WHERE d.survey_id = ? AND d.position > 0 AND u.status = 1 " +
      "ORDER BY d.position ASC, d.id ASC",
    [surveyId],
  );
  return rows.map((r) => ({
    historyId: String(r.draft_id),
    nickname: r.user_nickname as string,
    guildName: r.guild_name as string,
    votingType: r.voting_type as VotingType,
    className: (r.class_name as string) ?? null,
    classType: (r.class_type as ClassType) ?? null,
    votedAt: r.updated_at as Date,
    firstVotedAt: r.created_at as Date,
  }));
}

/*
 * 오늘 투표 회차와 그 뒤 예정 큐.
 * 투표 페이지와 달리 거점전 시각이 지날 때까지 회차를 물고 있는다.
 * 마감 뒤 순번 조정과 발표를 여기서 해야 하기 때문이다.
 */
export async function getScheduleOverview(
  now: Date = new Date(),
): Promise<{ current: DbSurvey | null; queue: DbSurvey[] }> {
  await flushExpiredDrafts(now);
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
