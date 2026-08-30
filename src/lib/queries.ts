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

/** 투표가 열리는 시각. exposed_at 그대로다. */
export function getVotingOpensAt(survey: DbSurvey): Date {
  return survey.exposed_at;
}

/**
 * 이번에 다룰 설문 하나 — 지금 열려 있거나, 곧 열릴 설문.
 *
 * 투표 가능 여부를 status 로 판단하지 않는 것이 핵심이다. 예전에는 봇이 30초
 * 루프에서 status 를 'process' 로 바꿔야 투표가 열렸고, 각 클라이언트는 5초
 * 폴링으로 그걸 발견했다. 그래서 같은 설문인데도 사람마다 최대 35초까지 늦게
 * 열려 순번이 뒤틀렸다. 이제 창은 순수하게 시간으로 정해진다.
 *
 *   exposed_at <= now < executed_at - 1시간
 *
 * 봇이 무엇을 하든(혹은 죽어 있든) 모두에게 같은 순간에 열린다. status 는 지난
 * 설문 분류와 봇 명령어에만 쓰인다.
 *
 * now 를 인자로 받는 이유는 DB 서버 시계가 UTC 라서다. mysql2 가 풀의 timezone
 * 설정으로 JS Date 를 올바르게 변환한다.
 */
export async function getCurrentSurvey(now: Date = new Date()): Promise<DbSurvey | null> {
  const closesAfter = new Date(now.getTime() + 60 * 60 * 1000);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id, announce_at, announce_content FROM survey " +
      // 관리자가 즉시 마감(complete)한 설문은 건너뛰고 다음 설문을 연다
      "WHERE status NOT IN ('cancel', 'complete') AND executed_at > ? ORDER BY exposed_at ASC LIMIT 1",
    [closesAfter],
  );
  return (rows[0] as DbSurvey) ?? null;
}

/** 지금 이 순간 투표를 받을 수 있는 설문인가. 서버가 최종 판단한다. */
export function isVotingOpen(survey: DbSurvey, now: Date = new Date()): boolean {
  // 관리자가 즉시 마감을 누르면 complete 가 찍힌다. 시각과 무관하게 닫는다.
  if (survey.status === "complete") return false;
  const opensAt = survey.exposed_at.getTime();
  const closesAt = survey.executed_at.getTime() - 60 * 60 * 1000;
  return now.getTime() >= opensAt && now.getTime() < closesAt;
}

/**
 * 지난 설문 탭에 보여줄, 투표가 이미 닫힌 가장 최근 설문.
 *
 * status = 'complete' 로 찾지 않는다. 그 값은 봇이 찍어주는 것이라, 봇이 멎으면
 * 지난 설문 탭이 옛날에 멈춰 버린다. 마감 시각(거점전 1시간 전)이 지났는지로
 * 판단하면 웹만으로 정확하다.
 */
export async function getLatestClosedSurvey(now: Date = new Date()): Promise<DbSurvey | null> {
  const closedBy = new Date(now.getTime() + 60 * 60 * 1000);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id, announce_at, announce_content FROM survey " +
      "WHERE status <> 'cancel' AND executed_at <= ? ORDER BY executed_at DESC LIMIT 1",
    [closedBy],
  );
  return (rows[0] as DbSurvey) ?? null;
}

export async function getSurveysInRange(from: Date, to: Date): Promise<DbSurvey[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id, announce_at, announce_content FROM survey " +
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

// ── 관리자용 ─────────────────────────────────────────────────

export interface VoterRow {
  nickname: string;
  guildName: string;
  votingType: VotingType;
  className: string | null;
  classType: ClassType | null;
  votedAt: Date;
}

/**
 * 한 설문의 투표자 명단. 봇의 !결과 와 같은 범위(활성 회원만)를 보되, 순번을
 * 볼 수 있도록 인원제한 결과와 같은 정렬(updated_at, id)을 쓴다.
 */
export async function getVoters(surveyId: string): Promise<VoterRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT u.user_nickname, g.name AS guild_name, sh.voting_type, sh.updated_at, " +
      "       cc.name AS class_name, cc.type AS class_type " +
      "FROM survey_history sh " +
      "JOIN user u ON sh.user_id = u.id " +
      "JOIN guild g ON u.guild_id = g.id " +
      "LEFT JOIN user_character_class_map m ON u.id = m.user_id " +
      "LEFT JOIN character_class cc ON m.character_class_id = cc.id " +
      "WHERE sh.survey_id = ? AND u.status = 1 " +
      "ORDER BY sh.updated_at ASC, sh.id ASC",
    [surveyId],
  );
  return rows.map((r) => ({
    nickname: r.user_nickname as string,
    guildName: r.guild_name as string,
    votingType: r.voting_type as VotingType,
    className: (r.class_name as string) ?? null,
    classType: (r.class_type as ClassType) ?? null,
    votedAt: r.updated_at as Date,
  }));
}

/** 아직 투표하지 않은 활성 회원. */
export async function getNonVoters(surveyId: string): Promise<{ nickname: string; guildName: string }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT u.user_nickname, g.name AS guild_name FROM user u " +
      "JOIN guild g ON u.guild_id = g.id " +
      "WHERE u.status = 1 AND u.id NOT IN (SELECT user_id FROM survey_history WHERE survey_id = ?) " +
      "ORDER BY g.id ASC, u.user_nickname ASC",
    [surveyId],
  );
  return rows.map((r) => ({
    nickname: r.user_nickname as string,
    guildName: r.guild_name as string,
  }));
}

/** 관리자 화면의 설문 목록. 최근 것부터. */
export async function getRecentSurveys(limit = 20): Promise<DbSurvey[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id, announce_at, announce_content FROM survey " +
      "WHERE status <> 'cancel' ORDER BY executed_at DESC LIMIT ?",
    [limit],
  );
  return rows as DbSurvey[];
}

/**
 * 설문 등록. 봇의 !거점설문등록 이 하던 일을 웹에서 한다.
 *
 * status 는 'wait' 으로 넣지만 투표 가능 여부와는 무관하다 — 창은 exposed_at 과
 * executed_at 으로만 정해진다(getCurrentSurvey 참조). 봇 명령어들이 아직 이 값을
 * 읽으므로 기존 값 체계를 그대로 따른다.
 */
export async function createSurvey(params: {
  content: string;
  executedAt: Date;
  exposedAt: Date;
  announceAt: Date | null;
  announceContent: string | null;
  /** 자동 등록이 만든 회차는 'node_war_auto' 로 표시해 수동 등록과 구분한다 */
  type?: string;
}): Promise<string> {
  const [result] = await pool.execute(
    "INSERT INTO survey (type, content, status, executed_at, exposed_at, announce_at, announce_content, created_at, updated_at) " +
      "VALUES (?, ?, 'process', ?, ?, ?, ?, NOW(), NOW())",
    [params.type ?? "node_war", params.content, params.executedAt, params.exposedAt, params.announceAt, params.announceContent],
  );
  return String((result as { insertId: number }).insertId);
}

/**
 * 공지를 보낼 차례가 된 설문. 보이지 않는 카운트다운이 이 시각을 목표로 돈다.
 * discord_message_id 가 비어 있는 것만 고른다 — 값이 있으면 이미 보낸 것이다.
 */
export async function getPendingAnnouncement(now: Date = new Date()): Promise<DbSurvey | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, discord_message_id, announce_at, announce_content FROM survey " +
      "WHERE status <> 'cancel' AND announce_at IS NOT NULL AND discord_message_id IS NULL " +
      "AND executed_at > ? ORDER BY announce_at ASC LIMIT 1",
    [now],
  );
  return (rows[0] as DbSurvey) ?? null;
}

/**
 * 공지 발송권을 선점한다. 150명의 브라우저가 같은 순간에 이 함수를 부르지만,
 * MySQL 이 같은 행의 UPDATE 를 한 줄로 세우므로 조건을 만족시키는 것은 하나뿐이다.
 * 확인과 기록이 한 문장 안에 있어야 한다 — SELECT 로 먼저 확인하면 둘 다 통과해
 * 공지가 두 번 나간다.
 *
 * 자리 표시로 0 을 넣고, 실제 메시지 id 는 발송 후 markAnnounced 로 채운다.
 * 발송이 실패하면 releaseAnnouncement 로 되돌려 다음 사람이 다시 시도하게 한다.
 */
export async function claimAnnouncement(surveyId: string, now: Date = new Date()): Promise<boolean> {
  const [result] = await pool.execute(
    "UPDATE survey SET discord_message_id = 0 " +
      "WHERE id = ? AND discord_message_id IS NULL AND announce_at IS NOT NULL AND announce_at <= ?",
    [surveyId, now],
  );
  return (result as { affectedRows: number }).affectedRows === 1;
}

/** 발송 성공. 웹훅이 돌려준 메시지 id 를 넣어 봇 명령어(!결과 등)가 찾을 수 있게 한다. */
export async function markAnnounced(surveyId: string, messageId: string | null): Promise<void> {
  await pool.execute("UPDATE survey SET discord_message_id = ?, updated_at = NOW() WHERE id = ?", [
    messageId ?? "0",
    surveyId,
  ]);
}

/** 발송 실패. 선점을 풀어 다음 요청이 재시도하게 한다. */
export async function releaseAnnouncement(surveyId: string): Promise<void> {
  await pool.execute("UPDATE survey SET discord_message_id = NULL WHERE id = ? AND discord_message_id = 0", [
    surveyId,
  ]);
}
