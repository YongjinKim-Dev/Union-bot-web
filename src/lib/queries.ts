import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import {
  ATTEND_TYPES,
  type ClassType,
  type DbCharacterClass,
  type DbSurvey,
  type DbUser,
  type UserCharacterClass,
  type VotingType,
} from "@/lib/types";

export async function getUserByDiscordId(discordId: string): Promise<DbUser | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, user_nickname, user_discord_id, guild_id, status, permission FROM user WHERE user_discord_id = ? AND status = 1",
    [discordId],
  );
  return (rows[0] as DbUser) ?? null;
}

// Mirrors the bot's check_sendable_survey / close_survey window: a survey is
// open for voting once it has been sent (status = 'process') and until one
// hour before executed_at.
export async function getActiveSurvey(): Promise<DbSurvey | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id FROM survey " +
      "WHERE status = 'process' ORDER BY exposed_at DESC LIMIT 1",
  );
  return (rows[0] as DbSurvey) ?? null;
}

export async function getVoteForUser(surveyId: string, userId: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, voting_type FROM survey_history WHERE survey_id = ? AND user_id = ?",
    [surveyId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id as string, votingType: row.voting_type as VotingType };
}

export interface CastVoteResult {
  votingType: VotingType;
  isDuplicated: boolean;
  isAttend: boolean;
}

export async function castVote(
  surveyId: string,
  userId: string,
  votingType: VotingType,
): Promise<CastVoteResult> {
  const existing = await getVoteForUser(surveyId, userId);

  if (existing) {
    if (existing.votingType === votingType) {
      return { votingType, isDuplicated: true, isAttend: ATTEND_TYPES.includes(votingType) };
    }
    // Switching between two "attending" types (attend <-> boarding) keeps the
    // original queue position; any other change resets updated_at, matching
    // the priority-ordering logic in !인원제한결과.
    const needsTimeUpdate = !(
      ATTEND_TYPES.includes(votingType) && ATTEND_TYPES.includes(existing.votingType)
    );
    const query = needsTimeUpdate
      ? "UPDATE survey_history SET voting_type = ?, updated_at = NOW() WHERE id = ?"
      : "UPDATE survey_history SET voting_type = ? WHERE id = ?";
    await pool.execute(query, [votingType, existing.id]);
  } else {
    await pool.execute(
      "INSERT INTO survey_history (voting_type, survey_id, user_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
      [votingType, surveyId, userId],
    );
  }

  return { votingType, isDuplicated: false, isAttend: ATTEND_TYPES.includes(votingType) };
}

export async function getUserCharacterClass(userId: string): Promise<UserCharacterClass | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT c.type, c.name FROM user_character_class_map m " +
      "JOIN character_class c ON m.character_class_id = c.id WHERE m.user_id = ?",
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { type: row.type as ClassType, name: row.name as string };
}

export async function getCharacterClassesByType(type: ClassType): Promise<DbCharacterClass[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, type FROM character_class WHERE type = ? ORDER BY name ASC",
    [type],
  );
  return rows as DbCharacterClass[];
}

export async function setUserCharacterClass(userId: string, characterClassId: string) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM user_character_class_map WHERE user_id = ?", [userId]);
    await connection.execute(
      "INSERT INTO user_character_class_map (user_id, character_class_id) VALUES (?, ?)",
      [userId, characterClassId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
