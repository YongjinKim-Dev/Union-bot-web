"use server";

import type { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

/*
 * 명단 편집은 전부 survey_history_final 에만 쓴다. survey_history 는 사람들이
 * 실제로 누른 표이므로 관리자 화면에서는 절대 건드리지 않는다. 그래서 뺀 사람도
 * 원본에는 남아 있고, 비교 탭에서 무엇이 달라졌는지 볼 수 있다.
 */

/* 확정 순번 저장. 화면의 최종 순서대로 position 을 1부터 다시 매긴다. */
export async function saveRosterOrderAction(surveyId: string, orderedIds: string[]) {
  await requireAdmin();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < orderedIds.length; i += 1) {
      // 투표 시각(updated_at)은 원본에서 온 값이라 순번을 바꿔도 손대지 않는다
      await connection.execute(
        "UPDATE survey_history_final SET position = ? WHERE id = ? AND survey_id = ?",
        [i + 1, orderedIds[i], surveyId],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  revalidatePath("/admin");
}

/* 명단에 사람을 수동으로 추가한다. 맨 뒤에 참여로 붙는다. */
export async function addVoteAction(surveyId: string, nickname: string) {
  await requireAdmin();

  const name = nickname.trim();
  if (!name) throw new Error("닉네임을 입력해 주세요.");

  const [users] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM user WHERE user_nickname = ? AND status = 1",
    [name],
  );
  if (users.length === 0) throw new Error(`"${name}" 닉네임의 연맹원이 없습니다.`);
  const userId = String(users[0].id);

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM survey_history_final WHERE survey_id = ? AND user_id = ?",
    [surveyId, userId],
  );
  if (existing.length > 0) throw new Error(`${name} 님은 이미 이 회차 명단에 있습니다.`);

  const now = new Date();
  await pool.execute(
    "INSERT INTO survey_history_final (survey_id, user_id, voting_type, position, created_at, updated_at) " +
      "SELECT ?, ?, 'attend', COALESCE(MAX(f.position), 0) + 1, ?, ? " +
      "FROM survey_history_final f WHERE f.survey_id = ?",
    [surveyId, userId, now, now, surveyId],
  );
  revalidatePath("/admin");
}

/*
 * 확정 명단에서 한 사람을 뺀다. 원본(survey_history)의 표는 그대로 남으므로
 * 비교 탭에서 "뺀 사람"으로 보이고, 다시 추가할 수도 있다.
 */
export async function removeVoteAction(surveyId: string, rowId: string) {
  await requireAdmin();
  await pool.execute("DELETE FROM survey_history_final WHERE id = ? AND survey_id = ?", [
    rowId,
    surveyId,
  ]);
  revalidatePath("/admin");
}
