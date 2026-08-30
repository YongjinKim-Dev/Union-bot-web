"use server";

import type { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

/* 서버 액션은 URL 만 알면 직접 호출될 수 있으므로 매번 역할을 확인한다. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.dbUserId) throw new Error("로그인이 필요합니다.");
  if (!session.user.isAdmin) throw new Error("권한이 없습니다.");
  return session.user;
}

/*
 * 조정한 순번을 저장한다. 순번의 실체가 updated_at 시각순이므로,
 * 이 회차 참여·부속 표들의 원래 시각을 정렬해 화면의 최종 순서대로 다시 나눠 준다.
 * 시각 묶음 자체는 보존되고 누가 어느 시각을 갖는지만 바뀐다.
 */
export async function saveRosterOrderAction(surveyId: string, orderedHistoryIds: string[]) {
  await requireAdmin();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, updated_at FROM survey_history WHERE survey_id = ? AND voting_type IN ('attend', 'boarding') " +
      "ORDER BY updated_at ASC, id ASC",
    [surveyId],
  );
  if (rows.length !== orderedHistoryIds.length) {
    throw new Error("명단이 바뀌었습니다. 새로 고침 후 다시 조정해 주세요.");
  }
  const known = new Set(rows.map((r) => String(r.id)));
  if (!orderedHistoryIds.every((id) => known.has(id))) {
    throw new Error("명단이 바뀌었습니다. 새로 고침 후 다시 조정해 주세요.");
  }

  // 같은 초에 들어온 표가 있으면 1초씩 벌려서 재부여 순서가 그대로 유지되게 한다
  const times: Date[] = [];
  for (const r of rows) {
    const t = new Date(r.updated_at as Date);
    const prev = times[times.length - 1];
    times.push(prev && t <= prev ? new Date(prev.getTime() + 1000) : t);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < orderedHistoryIds.length; i += 1) {
      await connection.execute("UPDATE survey_history SET updated_at = ? WHERE id = ?", [
        times[i],
        orderedHistoryIds[i],
      ]);
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
