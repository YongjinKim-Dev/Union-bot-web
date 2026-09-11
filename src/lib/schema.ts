import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

/*
 * 이미 있는 표에 칸을 뒤늦게 붙인다. MySQL 에는 ADD COLUMN IF NOT EXISTS 가
 * 없으므로 information_schema 를 먼저 본다.
 *
 * 표와 칸 이름은 모두 우리 코드가 적은 문자열이라 바깥에서 들어올 자리가 없다.
 */
export async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS found FROM information_schema.columns " +
      "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );
  if (Number(rows[0].found) > 0) return;
  await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
