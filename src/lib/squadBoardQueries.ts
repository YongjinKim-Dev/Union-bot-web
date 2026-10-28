import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

/*
 * 부대편성 판을 회차마다 저장한다.
 *
 * 화면에서만 들고 있던 때는 새로고침 한 번에 날아갔고, 둘이 같이 짜면 서로 다른
 * 판을 보고 있었다. 편성 한 벌이 몇 KB 라 통째로 넣고 통째로 꺼낸다 — 바뀐 칸만
 * 추려 낼 이유가 없는 크기다.
 *
 * version 은 저장할 때마다 하나씩 오른다. 화면은 이 숫자만 짧게 물어보고, 제
 * 것보다 높을 때에만 판 전체를 받아 간다.
 */
export async function ensureSquadBoardTable(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS squad_board (" +
      "survey_id bigint NOT NULL, " +
      "data mediumtext NOT NULL, " +
      "version int NOT NULL, " +
      "updated_by varchar(64) NULL, " +
      "updated_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (survey_id))",
  );
}

export interface SquadBoard {
  data: string;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

interface BoardRow extends RowDataPacket {
  data: string;
  version: number;
  updated_by: string | null;
  updated_at: Date;
}

export async function getSquadBoard(surveyId: string): Promise<SquadBoard | null> {
  const [rows] = await pool.query<BoardRow[]>(
    "SELECT data, version, updated_by, updated_at FROM squad_board WHERE survey_id = ?",
    [surveyId],
  );
  const row = rows[0];
  if (!row) return null;
  return { data: row.data, version: row.version, updatedBy: row.updated_by, updatedAt: row.updated_at };
}

/** 몇 초마다 물어보는 자리라 판 전체는 읽지 않는다. */
export async function getSquadBoardVersion(surveyId: string): Promise<number> {
  const [rows] = await pool.query<BoardRow[]>(
    "SELECT version FROM squad_board WHERE survey_id = ?",
    [surveyId],
  );
  return rows[0]?.version ?? 0;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; board: SquadBoard | null };

/*
 * 저장.
 *
 * baseVersion 은 "내가 보고 고친 판"의 번호다. 그 사이 남이 저장했으면 번호가
 * 달라지므로 거절하고 지금 것을 돌려준다. 그냥 덮어쓰면 남이 방금 옮긴 사람이
 * 소리 없이 제자리로 돌아간다.
 */
export async function saveSquadBoard(
  surveyId: string,
  data: string,
  baseVersion: number,
  updatedBy: string | null,
): Promise<SaveResult> {
  const now = new Date();
  if (baseVersion <= 0) {
    /* 아직 한 번도 저장되지 않은 회차. 먼저 넣은 쪽이 1 번이 된다.
     *
     * 넣고 나서 다시 읽어 확인한다. INSERT 가 몇 줄을 건드렸는지로 판단하면
     * 드라이버 설정에 따라 숫자가 달라지는데, 여기서 잘못 읽으면 남의 판을
     * 덮어쓴다. 첫 저장 한 번뿐이라 읽기 한 번이 아깝지 않다. */
    await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO squad_board (survey_id, data, version, updated_by, updated_at) " +
        "VALUES (?, ?, 1, ?, ?)",
      [surveyId, data, updatedBy, now],
    );
    const board = await getSquadBoard(surveyId);
    if (board && board.version === 1 && board.data === data) return { ok: true, version: 1 };
    return { ok: false, board };
  }
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE squad_board SET data = ?, version = version + 1, updated_by = ?, updated_at = ? " +
      "WHERE survey_id = ? AND version = ?",
    [data, updatedBy, now, surveyId, baseVersion],
  );
  if (result.affectedRows === 1) return { ok: true, version: baseVersion + 1 };
  return { ok: false, board: await getSquadBoard(surveyId) };
}
