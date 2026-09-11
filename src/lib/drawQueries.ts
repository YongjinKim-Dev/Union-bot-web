import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

/*
 * 추첨 기록.
 *
 * 남기는 것은 두 가지다 — 누가 참여했고 누가 뽑혔나. 그리고 씨앗.
 * 씨앗이 있으면 같은 명단으로 다시 돌려 같은 결과가 나오는지 누구든 확인할 수
 * 있다. 그것이 이 표가 존재하는 이유다.
 *
 * 투표 회차와는 느슨하게 잇는다. 정원이 넘쳐 빈 자리를 메우는 것이 지금의 쓰임
 * 이지만, 그것 말고도 뽑을 일은 생긴다. survey_id 가 비어 있어도 추첨은 선다.
 */
export async function ensureDrawTables(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS draw (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "title varchar(60) NOT NULL, " +
      "survey_id bigint NULL, " +
      "mode varchar(20) NOT NULL, " +
      "seed varchar(32) NOT NULL, " +
      "pick_count int NOT NULL, " +
      "entry_count int NOT NULL, " +
      "drawn_by bigint NOT NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_draw_survey (survey_id), " +
      "KEY idx_draw_created (created_at))",
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS draw_entry (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      // 회원이 아닌 이름도 넣을 수 있어야 하므로 user_id 는 비어도 된다.
      "user_id bigint NULL, " +
      "draw_id bigint NOT NULL, " +
      "nickname varchar(64) NOT NULL, " +
      // 뽑힌 순서. 0 부터 pick_count-1 까지가 당첨이다.
      "position int NOT NULL, " +
      "is_winner tinyint(1) NOT NULL, " +
      "PRIMARY KEY (id), " +
      // 같은 사람을 두 번 넣으면 뽑을 확률이 두 배가 된다.
      "UNIQUE KEY uq_entry_draw_nickname (draw_id, nickname), " +
      "KEY idx_entry_draw (draw_id))",
  );
}

export interface DrawEntryRow {
  userId: string | null;
  nickname: string;
  position: number;
  isWinner: boolean;
}
export interface DrawRow {
  id: string;
  title: string;
  surveyId: string | null;
  mode: string;
  seed: string;
  pickCount: number;
  entryCount: number;
  drawnByNickname: string | null;
  createdAt: Date;
}

export async function saveDraw(
  draw: Omit<DrawRow, "id" | "createdAt" | "drawnByNickname"> & { drawnBy: string },
  entries: DrawEntryRow[],
): Promise<string> {
  const now = new Date();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO draw (title, survey_id, mode, seed, pick_count, entry_count, drawn_by, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [draw.title, draw.surveyId, draw.mode, draw.seed, draw.pickCount, draw.entryCount, draw.drawnBy, now],
    );
    const drawId = String(result.insertId);
    for (const entry of entries) {
      await connection.execute(
        "INSERT INTO draw_entry (draw_id, user_id, nickname, position, is_winner) VALUES (?, ?, ?, ?, ?)",
        [drawId, entry.userId, entry.nickname, entry.position, entry.isWinner ? 1 : 0],
      );
    }
    await connection.commit();
    return drawId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getDraws(limit = 20): Promise<DrawRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT d.id, d.title, d.survey_id, d.mode, d.seed, d.pick_count, d.entry_count, d.created_at, " +
      "u.user_nickname AS drawn_by_nickname " +
      "FROM draw d LEFT JOIN user u ON u.id = d.drawn_by " +
      "ORDER BY d.created_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    surveyId: row.survey_id === null ? null : String(row.survey_id),
    mode: row.mode,
    seed: row.seed,
    pickCount: row.pick_count,
    entryCount: row.entry_count,
    drawnByNickname: row.drawn_by_nickname ?? null,
    createdAt: row.created_at,
  }));
}

export async function getDrawEntries(drawId: string): Promise<DrawEntryRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT user_id, nickname, position, is_winner FROM draw_entry WHERE draw_id = ? ORDER BY position ASC",
    [drawId],
  );
  return rows.map((row) => ({
    userId: row.user_id === null ? null : String(row.user_id),
    nickname: row.nickname,
    position: row.position,
    isWinner: row.is_winner === 1,
  }));
}
