"use server";

import type { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { sendSurveyAnnouncement } from "@/lib/discord";

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

/*
 * 명단에 사람을 수동으로 추가한다. 닉네임으로 활성 연맹원을 찾아 참여 표를
 * 지금 시각으로 넣으므로 순번은 맨 뒤가 된다.
 */
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
    "SELECT id FROM survey_history WHERE survey_id = ? AND user_id = ?",
    [surveyId, userId],
  );
  if (existing.length > 0) throw new Error(`${name} 님은 이미 이 회차에 투표했습니다.`);

  const now = new Date();
  await pool.execute(
    "INSERT INTO survey_history (voting_type, survey_id, user_id, created_at, updated_at) VALUES ('attend', ?, ?, ?, ?)",
    [surveyId, userId, now, now],
  );
  revalidatePath("/admin");
}

/* 이 회차에서 표 한 장을 뺀다. 그 사람은 미투표 상태로 돌아간다. */
export async function removeVoteAction(surveyId: string, historyId: string) {
  await requireAdmin();
  await pool.execute("DELETE FROM survey_history WHERE id = ? AND survey_id = ?", [historyId, surveyId]);
  revalidatePath("/admin");
}

/* 결과 명단을 설문 공지 채널로 보낸다. 공지와 같은 웹훅을 그대로 쓴다. */
export async function sendRosterAction(text: string): Promise<boolean> {
  await requireAdmin();
  const messageId = await sendSurveyAnnouncement(text);
  return messageId !== null;
}
