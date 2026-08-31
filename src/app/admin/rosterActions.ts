"use server";

import type { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { sendSurveyAnnouncement } from "@/lib/discord";

/* 조정한 순번을 저장한다. 화면의 최종 순서대로 draft의 position을 다시 부여한다. */
export async function saveRosterOrderAction(surveyId: string, orderedDraftIds: string[]) {
  await requireAdmin();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (let i = 0; i < orderedDraftIds.length; i += 1) {
      // updated_at은 폴링의 기준 시각이므로 건드리지 않는다
      await connection.execute("UPDATE survey_history_draft SET position = ? WHERE id = ?", [
        i + 1,
        orderedDraftIds[i],
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
 * 명단에 사람을 수동으로 추가한다. 닉네임으로 활성 연맹원을 찾아 draft 맨 뒤에
 * 참여로 넣는다. 원본에는 쓰지 않는다.
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
    "SELECT id, position FROM survey_history_draft WHERE survey_id = ? AND user_id = ?",
    [surveyId, userId],
  );
  if (existing.length > 0 && Number(existing[0].position) > 0) {
    throw new Error(`${name} 님은 이미 이 회차 명단에 있습니다.`);
  }

  if (existing.length > 0) {
    // 뺐던 사람이면 순번만 맨 뒤 번호로 되살린다. 미참 상태로 뺐던 경우는 참여로 넣는다
    await pool.execute(
      "UPDATE survey_history_draft SET voting_type = 'attend', position = " +
        "(SELECT COALESCE(MAX(position), 0) + 1 FROM (SELECT position FROM survey_history_draft WHERE survey_id = ?) base) " +
        "WHERE id = ?",
      [surveyId, existing[0].id],
    );
  } else {
    await pool.execute(
      "INSERT INTO survey_history_draft (voting_type, survey_id, user_id, position, created_at, updated_at) " +
        "SELECT 'attend', ?, ?, COALESCE(MAX(position), 0) + 1, NOW(), NOW() " +
        "FROM survey_history_draft WHERE survey_id = ?",
      [surveyId, userId, surveyId],
    );
  }
  revalidatePath("/admin");
}

/*
 * 이 회차 명단에서 한 사람을 뺀다. 행을 지우는 대신 순번을 0으로 바꿔서
 * 명단 밖으로 보낸다. 행이 남아 있어야 폴링이 새 표와 구분할 수 있다.
 */
export async function removeVoteAction(surveyId: string, draftId: string) {
  await requireAdmin();
  await pool.execute("UPDATE survey_history_draft SET position = 0 WHERE id = ? AND survey_id = ?", [
    draftId,
    surveyId,
  ]);
  revalidatePath("/admin");
}

/* 결과 명단을 설문 공지 채널로 보낸다. 공지와 같은 웹훅을 그대로 쓴다. */
export async function sendRosterAction(text: string): Promise<boolean> {
  await requireAdmin();
  const messageId = await sendSurveyAnnouncement(text);
  return messageId !== null;
}
