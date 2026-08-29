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

/**
 * The survey a member can actually vote on right now.
 *
 * `status = 'process'` alone is not enough: the bot's close task needs to edit
 * its Discord message, and when that fails the row is left at 'process'
 * forever — the live DB has 13 such rows, the newest from a node war 11 days
 * past. Requiring executed_at to be recent keeps a stale row from presenting
 * itself as the open survey, while still covering one that closed minutes ago
 * and is waiting on the bot to mark it complete.
 *
 * `now` is passed rather than using SQL NOW() because the DB server's clock is
 * UTC while the app reasons in KST; mysql2 converts a JS Date correctly using
 * the pool's timezone setting.
 */
export async function getOpenSurvey(now: Date = new Date()): Promise<DbSurvey | null> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id FROM survey " +
      "WHERE status = 'process' AND executed_at >= ? ORDER BY executed_at ASC LIMIT 1",
    [since],
  );
  return (rows[0] as DbSurvey) ?? null;
}

/** The next survey the bot has registered but not yet posted. */
export async function getNextWaitingSurvey(): Promise<DbSurvey | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id FROM survey " +
      "WHERE status = 'wait' ORDER BY exposed_at ASC LIMIT 1",
  );
  return (rows[0] as DbSurvey) ?? null;
}

/** The most recently held survey, for the 지난 설문 tab. */
export async function getLatestCompletedSurvey(): Promise<DbSurvey | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id FROM survey " +
      "WHERE status = 'complete' ORDER BY executed_at DESC LIMIT 1",
  );
  return (rows[0] as DbSurvey) ?? null;
}

export async function getSurveysInRange(from: Date, to: Date): Promise<DbSurvey[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id FROM survey " +
      "WHERE executed_at >= ? AND executed_at < ? AND status <> 'cancel' " +
      "ORDER BY executed_at ASC",
    [from, to],
  );
  return rows as DbSurvey[];
}

export interface VoteRecord {
  id: string;
  votingType: VotingType;
  votedAt: Date;
}

export async function getVoteForUser(surveyId: string, userId: string): Promise<VoteRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, voting_type, updated_at FROM survey_history WHERE survey_id = ? AND user_id = ?",
    [surveyId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    votingType: row.voting_type as VotingType,
    votedAt: row.updated_at as Date,
  };
}

/**
 * This user's vote across several surveys at once, keyed by survey id. The
 * home page needs six of these, so they go out as one IN query rather than
 * six round trips.
 */
export async function getVotesForUser(
  surveyIds: string[],
  userId: string,
): Promise<Map<string, VoteRecord>> {
  const result = new Map<string, VoteRecord>();
  if (surveyIds.length === 0) return result;

  const placeholders = surveyIds.map(() => "?").join(", ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, survey_id, voting_type, updated_at FROM survey_history ` +
      `WHERE user_id = ? AND survey_id IN (${placeholders})`,
    [userId, ...surveyIds],
  );

  for (const row of rows) {
    result.set(String(row.survey_id), {
      id: row.id as string,
      votingType: row.voting_type as VotingType,
      votedAt: row.updated_at as Date,
    });
  }
  return result;
}

export interface CastVoteResult {
  votingType: VotingType;
  isDuplicated: boolean;
  isAttend: boolean;
  votedAt: Date;
}

export async function castVote(
  surveyId: string,
  userId: string,
  votingType: VotingType,
): Promise<CastVoteResult> {
  const existing = await getVoteForUser(surveyId, userId);

  if (existing) {
    if (existing.votingType === votingType) {
      return {
        votingType,
        isDuplicated: true,
        isAttend: ATTEND_TYPES.includes(votingType),
        votedAt: existing.votedAt,
      };
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

  // Re-read the row so votedAt reflects the actual DB-computed NOW() rather
  // than an approximate client-side timestamp.
  const updated = await getVoteForUser(surveyId, userId);
  return {
    votingType,
    isDuplicated: false,
    isAttend: ATTEND_TYPES.includes(votingType),
    votedAt: updated!.votedAt,
  };
}

// Same tally the bot's !결과 command computes: per voting_type counts among
// currently active (status = 1) members.
export async function getVoteCounts(surveyId: string): Promise<Record<VotingType, number>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT survey_history.voting_type, COUNT(*) AS count FROM survey_history " +
      "JOIN user ON survey_history.user_id = user.id " +
      "WHERE survey_history.survey_id = ? AND user.status = 1 " +
      "GROUP BY survey_history.voting_type",
    [surveyId],
  );
  const counts: Record<VotingType, number> = {
    attend: 0,
    non_attend: 0,
    boarding: 0,
    late_attend: 0,
  };
  for (const row of rows) {
    counts[row.voting_type as VotingType] = Number(row.count);
  }
  return counts;
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
