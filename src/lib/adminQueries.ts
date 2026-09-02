import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { ClassType, DbSurvey, VotingType } from "@/lib/types";
import type { VoterRow } from "@/lib/queries";

/* 관리자 화면 전용 조회 */

/*
 * 확정 명단 테이블.
 *
 * survey_history 는 사람들이 실제로 누른 표이고, 이 테이블은 관리자가 확정한
 * 명단이다. 둘은 목적이 다르므로 서로 덮어쓰지 않는다 — 원본은 투표로만 쓰이고
 * 관리자 화면은 이 테이블에만 쓴다. 그래서 "누가 무엇을 눌렀나" 는 영구히 남고,
 * 뺀 사람도 원본에는 그대로 있어 나중에 대조할 수 있다.
 *
 * position 은 확정 순번이다. survey_history 에는 순번 칸이 없어서 시각으로
 * 순서를 표현했는데, 그러면 순번을 바꿀 때마다 투표 시각을 조작해야 했다.
 */
export async function ensureFinalTable(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS survey_history_final (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "survey_id bigint NOT NULL, " +
      "user_id bigint NOT NULL, " +
      "voting_type varchar(20) NOT NULL, " +
      "position int NOT NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "UNIQUE KEY uq_final_survey_user (survey_id, user_id), " +
      "KEY idx_final_survey (survey_id))",
  );

  // 기존 회차는 조정 없이 끝났으므로 원본이 곧 확정 명단이다. 한 번만 채운다.
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT EXISTS(SELECT 1 FROM survey_history_final) AS filled",
  );
  if (Number(rows[0].filled) === 1) return;
  await pool.execute(
    "INSERT INTO survey_history_final (survey_id, user_id, voting_type, position, created_at, updated_at) " +
      "SELECT h.survey_id, h.user_id, h.voting_type, " +
      "       ROW_NUMBER() OVER (PARTITION BY h.survey_id ORDER BY h.updated_at ASC, h.id ASC), " +
      "       h.created_at, h.updated_at " +
      "FROM survey_history h JOIN survey s ON s.id = h.survey_id " +
      "WHERE s.executed_at <= NOW()",
  );
}

/* 투표 마감 시각. 거점전 1시간 전이다. */
function closesAt(executedAt: Date): Date {
  return new Date(executedAt.getTime() - 60 * 60 * 1000);
}

const ROSTER_COLUMNS =
  "u.user_nickname, g.name AS guild_name, cc.name AS class_name, cc.type AS class_type ";
const ROSTER_JOINS =
  "JOIN user u ON src.user_id = u.id " +
  "JOIN guild g ON u.guild_id = g.id " +
  "LEFT JOIN user_character_class_map m ON u.id = m.user_id " +
  "LEFT JOIN character_class cc ON m.character_class_id = cc.id ";

function toVoterRow(r: RowDataPacket): VoterRow {
  return {
    historyId: String(r.row_id),
    nickname: r.user_nickname as string,
    guildName: r.guild_name as string,
    votingType: r.voting_type as VotingType,
    className: (r.class_name as string) ?? null,
    classType: (r.class_type as ClassType) ?? null,
    votedAt: r.updated_at as Date,
    firstVotedAt: r.created_at as Date,
  };
}

/* 사람들이 실제로 누른 표. 투표한 순서대로. 어떤 경우에도 쓰지 않는다. */
export async function getOriginalRoster(surveyId: string): Promise<VoterRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT src.id AS row_id, src.voting_type, src.updated_at, src.created_at, " +
      ROSTER_COLUMNS +
      "FROM survey_history src " +
      ROSTER_JOINS +
      "WHERE src.survey_id = ? AND u.status = 1 " +
      "ORDER BY src.updated_at ASC, src.id ASC",
    [surveyId],
  );
  return rows.map(toVoterRow);
}

/*
 * 확정 명단. 아직 없고 투표가 마감됐으면 원본을 그대로 복사해 만든다.
 *
 * 마감 뒤에는 새 표가 들어올 수 없으므로 복사 한 번이면 끝이고, 원본과 확정본을
 * 계속 맞춰 주는 동기화 로직이 필요 없다. 마감 전이라면 아직 만들지 않고 원본을
 * 그대로 보여준다 — 그동안 화면은 집계만 보는 용도다.
 */
export async function getFinalRoster(
  surveyId: string,
  now: Date = new Date(),
): Promise<{ rows: VoterRow[]; confirmed: boolean }> {
  const [surveyRows] = await pool.query<RowDataPacket[]>(
    "SELECT executed_at FROM survey WHERE id = ?",
    [surveyId],
  );
  if (surveyRows.length === 0) return { rows: [], confirmed: false };
  const votingClosed = now >= closesAt(surveyRows[0].executed_at as Date);

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT EXISTS(SELECT 1 FROM survey_history_final WHERE survey_id = ?) AS filled",
    [surveyId],
  );
  if (Number(existing[0].filled) === 0) {
    if (!votingClosed) return { rows: await getOriginalRoster(surveyId), confirmed: false };
    await pool.execute(
      "INSERT IGNORE INTO survey_history_final (survey_id, user_id, voting_type, position, created_at, updated_at) " +
        "SELECT h.survey_id, h.user_id, h.voting_type, " +
        "       ROW_NUMBER() OVER (ORDER BY h.updated_at ASC, h.id ASC), " +
        "       h.created_at, h.updated_at " +
        "FROM survey_history h WHERE h.survey_id = ?",
      [surveyId],
    );
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT src.id AS row_id, src.voting_type, src.updated_at, src.created_at, " +
      ROSTER_COLUMNS +
      "FROM survey_history_final src " +
      ROSTER_JOINS +
      "WHERE src.survey_id = ? AND u.status = 1 " +
      "ORDER BY src.position ASC, src.id ASC",
    [surveyId],
  );
  return { rows: rows.map(toVoterRow), confirmed: true };
}

/*
 * 오늘 투표 회차와 그 뒤 예정 큐.
 * 투표 페이지와 달리 거점전 시각이 지날 때까지 회차를 물고 있는다.
 * 마감 뒤 순번 조정과 발표를 여기서 해야 하기 때문이다.
 */
export async function getScheduleOverview(
  now: Date = new Date(),
): Promise<{ current: DbSurvey | null; queue: DbSurvey[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, announce_at, announce_content, discord_message_id " +
      "FROM survey WHERE status <> 'cancel' AND executed_at > ? " +
      "ORDER BY executed_at ASC, exposed_at ASC, id ASC",
    [now],
  );
  const list = rows as DbSurvey[];
  const opened = list
    .filter((s) => s.exposed_at <= now)
    .sort(
      (a, b) =>
        b.exposed_at.getTime() - a.exposed_at.getTime() || Number(b.id) - Number(a.id),
    );
  const future = list
    .filter((s) => s.exposed_at > now)
    .sort(
      (a, b) =>
        a.exposed_at.getTime() - b.exposed_at.getTime() || Number(b.id) - Number(a.id),
    );

  // 열린 회차가 있으면 가장 최근에 열린 것이 오늘 투표,
  // 없으면 가장 가까운 미래 회차를 대기 상태로 보여준다.
  if (opened.length > 0) return { current: opened[0], queue: future };
  if (future.length === 0) return { current: null, queue: [] };
  return { current: future[0], queue: future.slice(1) };
}

export interface PastSurveyRow {
  id: string;
  executed_at: Date;
  exposed_at: Date;
  counts: { 참여: number; 부속: number; 늦참: number; 미참: number };
}

/*
 * 지난 회차 목록. 운영 화면(오늘 투표와 큐)이 보여주지 않는 회차가 지난 투표다.
 * 그래서 새 투표가 열려 앞 회차가 밀려나는 순간 그 회차는 바로 여기에 나타난다.
 */
export async function getPastSurveys(
  page: number,
  size: number,
  now: Date = new Date(),
): Promise<{ rows: PastSurveyRow[]; total: number }> {
  const offset = (page - 1) * size;
  const { current, queue } = await getScheduleOverview(now);
  const activeIds = [current, ...queue].filter((s) => s !== null).map((s) => s.id);
  const exclude = activeIds.length > 0 ? `AND s.id NOT IN (${activeIds.map(() => "?").join(",")})` : "";
  const excludeCount = activeIds.length > 0 ? `AND id NOT IN (${activeIds.map(() => "?").join(",")})` : "";

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM survey WHERE status <> 'cancel' ${excludeCount}`,
    activeIds,
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT s.id, s.executed_at, s.exposed_at, " +
      "SUM(h.voting_type = 'attend') AS a, SUM(h.voting_type = 'boarding') AS b, " +
      "SUM(h.voting_type = 'late_attend') AS l, SUM(h.voting_type = 'non_attend') AS n " +
      "FROM survey s LEFT JOIN survey_history h ON h.survey_id = s.id " +
      `WHERE s.status <> 'cancel' ${exclude} ` +
      "GROUP BY s.id, s.executed_at, s.exposed_at " +
      `ORDER BY s.executed_at DESC, s.id DESC LIMIT ${Number(size)} OFFSET ${Number(offset)}`,
    activeIds,
  );
  return {
    total: Number(countRows[0].c),
    rows: rows.map((r) => ({
      id: String(r.id),
      executed_at: r.executed_at as Date,
      exposed_at: r.exposed_at as Date,
      counts: {
        참여: Number(r.a ?? 0),
        부속: Number(r.b ?? 0),
        늦참: Number(r.l ?? 0),
        미참: Number(r.n ?? 0),
      },
    })),
  };
}

export type DiffStatus = "유지" | "순번 변경" | "뺌" | "추가";

export interface RosterDiffRow {
  nickname: string;
  guildName: string;
  className: string | null;
  votingType: VotingType | null;
  votedAt: Date | null;
  originalRank: number | null;
  finalRank: number | null;
  status: DiffStatus;
}

/*
 * 원본과 확정 명단을 나란히 놓고 무엇이 달라졌는지 만든다.
 * 원본에만 있으면 관리자가 뺀 사람, 확정본에만 있으면 관리자가 넣은 사람이다.
 */
export async function getRosterComparison(surveyId: string): Promise<RosterDiffRow[]> {
  const [original, final] = await Promise.all([
    getOriginalRoster(surveyId),
    getFinalRoster(surveyId),
  ]);

  const originalRank = new Map(original.map((v, i) => [v.nickname, i + 1]));
  const finalRank = new Map(final.rows.map((v, i) => [v.nickname, i + 1]));
  const byNick = new Map([...original, ...final.rows].map((v) => [v.nickname, v]));

  const rows: RosterDiffRow[] = [];
  for (const [nickname, v] of byNick) {
    const o = originalRank.get(nickname) ?? null;
    const f = finalRank.get(nickname) ?? null;
    const status: DiffStatus =
      o === null ? "추가" : f === null ? "뺌" : o === f ? "유지" : "순번 변경";
    rows.push({
      nickname,
      guildName: v.guildName,
      className: v.className,
      votingType: v.votingType,
      votedAt: v.votedAt,
      originalRank: o,
      finalRank: f,
      status,
    });
  }
  // 달라진 것부터 위로, 그다음 확정 순번대로
  const weight: Record<DiffStatus, number> = { 뺌: 0, 추가: 1, "순번 변경": 2, 유지: 3 };
  rows.sort(
    (a, b) =>
      weight[a.status] - weight[b.status] ||
      (a.finalRank ?? a.originalRank ?? 0) - (b.finalRank ?? b.originalRank ?? 0),
  );
  return rows;
}

/*
 * 비교 탭에 나열할 회차. 지난 회차 목록과 달리 지금 운영 중인 회차도 뺀 것 없이
 * 보여준다. 조정을 막 끝낸 회차가 바로 그 회차인데, 그것이 목록에 없으면 확인할
 * 방법이 없다. 집계는 확정 명단 기준이다.
 */
export async function getComparableSurveys(
  page: number,
  size: number,
): Promise<{ rows: PastSurveyRow[]; total: number }> {
  const offset = (page - 1) * size;
  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(DISTINCT s.id) AS c FROM survey s " +
      "JOIN survey_history_final f ON f.survey_id = s.id WHERE s.status <> 'cancel'",
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT s.id, s.executed_at, s.exposed_at, " +
      "SUM(f.voting_type = 'attend') AS a, SUM(f.voting_type = 'boarding') AS b, " +
      "SUM(f.voting_type = 'late_attend') AS l, SUM(f.voting_type = 'non_attend') AS n " +
      "FROM survey s JOIN survey_history_final f ON f.survey_id = s.id " +
      "WHERE s.status <> 'cancel' " +
      "GROUP BY s.id, s.executed_at, s.exposed_at " +
      `ORDER BY s.executed_at DESC, s.id DESC LIMIT ${Number(size)} OFFSET ${Number(offset)}`,
  );
  return {
    total: Number(countRows[0].c),
    rows: rows.map((r) => ({
      id: String(r.id),
      executed_at: r.executed_at as Date,
      exposed_at: r.exposed_at as Date,
      counts: {
        참여: Number(r.a ?? 0),
        부속: Number(r.b ?? 0),
        늦참: Number(r.l ?? 0),
        미참: Number(r.n ?? 0),
      },
    })),
  };
}
