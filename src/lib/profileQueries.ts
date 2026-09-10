import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import type { ClassType, UserCharacterClass } from "@/lib/types";

export interface ProfileMembership {
  guildName: string | null;
  characterClass: UserCharacterClass | null;
}

export interface ProfileSubmission {
  surveyTitle: string | null;
  ap: number;
  aap: number;
  dp: number;
  isComplete: boolean;
  submittedAt: Date;
}

export async function getProfileMembership(userId: string): Promise<ProfileMembership> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT g.name AS guild_name, c.name AS class_name, c.type AS class_type " +
      "FROM user u LEFT JOIN guild g ON g.id = u.guild_id " +
      "LEFT JOIN user_character_class_map m ON m.user_id = u.id " +
      "LEFT JOIN character_class c ON c.id = m.character_class_id " +
      "WHERE u.id = ? AND u.status = 1 ORDER BY m.id DESC LIMIT 1",
    [userId],
  );
  const row = rows[0];
  return {
    guildName: row?.guild_name ?? null,
    characterClass: row?.class_name && row.class_type
      ? { name: row.class_name, type: row.class_type as ClassType }
      : null,
  };
}

export async function getLatestProfileSubmission(userId: string): Promise<ProfileSubmission | null> {
  // 최신 조사 여부와 관계없이 본인이 마지막으로 낸 스펙을 표시합니다.
  // 재제출은 같은 행을 갱신하므로 id가 아닌 updated_at을 먼저 비교합니다.
  //
  // 공방합은 여기서 내지 않는다. 어느 공격력을 보는지는 지금 등록된 직업이
  // 정하므로, 직업을 함께 아는 화면에서 계산한다.
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT v.title AS survey_title, s.ap, s.aap, s.dp, s.is_complete, s.updated_at " +
      "FROM spec_submission s LEFT JOIN spec_survey v ON v.id = s.spec_survey_id " +
      "WHERE s.user_id = ? ORDER BY s.updated_at DESC, s.id DESC LIMIT 1",
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    surveyTitle: row.survey_title ?? null,
    ap: row.ap,
    aap: row.aap,
    dp: row.dp,
    isComplete: Number(row.is_complete) === 1,
    submittedAt: row.updated_at,
  };
}
