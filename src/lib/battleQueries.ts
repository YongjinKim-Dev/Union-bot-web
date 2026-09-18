import type mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { avatarUrl } from "@/lib/memberQueries";
import { ensureColumn } from "@/lib/schema";
import type { ClassType } from "@/lib/types";

/*
 * 거점전 자리 안내.
 *
 * 지역 > 거점 > 자리 세 단계다. 자리마다 스크린샷 한 장과 짧은 설명이 붙고,
 * 댓글은 자리가 아니라 거점에 달린다 — 자리 하나만 놓고 할 말보다 "이 거점을
 * 어떻게 먹을까" 하는 말이 더 많기 때문이다.
 *
 * 무엇도 지우지 않는다. 티어가 바뀌면 지역이 통째로 안 쓰이게 되지만, 그때
 * 적어 둔 자리와 그 밑의 이야기는 다음 시즌에 다시 본다. 그래서 지우는 자리에
 * 는 is_active 만 내리고 행은 남긴다.
 */

/** 새로 만든 거점에 미리 깔아 두는 자리 수. 3~4 개를 쓰므로 4 칸을 준다. */
const DEFAULT_SPOTS = 4;
/** 티어가 무제한이라 지금 도는 지역은 이 둘이다. 이름은 관리자가 고칠 수 있다. */
const SEED_REGIONS = ["에다니아-외부", "발렌시아"];
const SEED_BASES = 6;

export async function ensureBattleTables(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS battle_region (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "name varchar(40) NOT NULL, " +
      "sort_order int NOT NULL, " +
      "is_active tinyint(1) NOT NULL DEFAULT 1, " +
      "created_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_region_order (sort_order))",
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS battle_base (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "region_id bigint NOT NULL, " +
      "name varchar(40) NOT NULL, " +
      "sort_order int NOT NULL, " +
      "is_active tinyint(1) NOT NULL DEFAULT 1, " +
      "created_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_base_region (region_id, sort_order))",
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS battle_spot (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "base_id bigint NOT NULL, " +
      "name varchar(60) NOT NULL, " +
      "description varchar(500) NOT NULL, " +
      // 사진은 나중에 붙인다. 지금은 화면에 자리만 잡아 두고 칸은 비워 둔다.
      "image_key varchar(160) NULL, " +
      "sort_order int NOT NULL, " +
      "is_active tinyint(1) NOT NULL DEFAULT 1, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NULL, " +
      "updated_by bigint NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_spot_base (base_id, sort_order))",
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS battle_comment (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "base_id bigint NOT NULL, " +
      "user_id bigint NOT NULL, " +
      // 닉네임은 적을 때 찍어 둔다. 나중에 바꿔도 그때 누가 썼는지는 남는다.
      "nickname varchar(64) NOT NULL, " +
      "body varchar(1000) NOT NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NULL, " +
      // 지운 댓글도 행은 남는다. 화면에서만 내용을 감춘다.
      "removed_at datetime(6) NULL, " +
      "removed_by bigint NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_comment_base (base_id, created_at))",
  );
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS battle_comment_log (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "comment_id bigint NOT NULL, " +
      // edit | remove | restore
      "action varchar(10) NOT NULL, " +
      // 바뀌기 직전의 글. 이것만 있으면 어떤 글이 어떻게 바뀌었는지 되짚을 수 있다.
      "body_before varchar(1000) NOT NULL, " +
      "actor_id bigint NOT NULL, " +
      "actor_nickname varchar(64) NOT NULL, " +
      "logged_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_comment_log (comment_id, logged_at))",
  );
  // battle_spot 은 이미 배포되어 있으므로 칸을 뒤늦게 붙인다.
  await ensureColumn("battle_spot", "image_type", "varchar(40) NULL");
  // 기본은 차단이다. 올릴 때 따로 켜 주지 않으면 로그인한 사람만 본다.
  await ensureColumn("battle_spot", "image_public", "tinyint(1) NOT NULL DEFAULT 0");
  // 거점 전체를 한눈에 보는 지도. 자리 사진이 "어디에 서나"라면 이건 "거점이
  // 어떻게 생겼나"다. 공개 여부는 자리 사진과 같은 규칙을 따른다.
  await ensureColumn("battle_base", "map_key", "varchar(160) NULL");
  await ensureColumn("battle_base", "map_type", "varchar(40) NULL");
  await ensureColumn("battle_base", "map_public", "tinyint(1) NOT NULL DEFAULT 0");
  await seedRegions();
}

/* 표가 비어 있을 때만 심는다. 관리자가 지역을 다 내려 두었다면 그건 빈 것이
   아니라 그렇게 둔 것이므로, 행이 하나라도 있으면 손대지 않는다. */
async function seedRegions(): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS found FROM battle_region");
  if (Number(rows[0].found) > 0) return;

  const now = new Date();
  for (const [index, name] of SEED_REGIONS.entries()) {
    const [region] = await pool.execute<ResultSetHeader>(
      "INSERT INTO battle_region (name, sort_order, is_active, created_at) VALUES (?, ?, 1, ?)",
      [name, index, now],
    );
    for (let order = 0; order < SEED_BASES; order += 1) {
      const [base] = await pool.execute<ResultSetHeader>(
        "INSERT INTO battle_base (region_id, name, sort_order, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
        [region.insertId, `${order + 1}거점`, order, now],
      );
      await insertDefaultSpots(String(base.insertId), now);
    }
  }
}

async function insertDefaultSpots(baseId: string, now: Date): Promise<void> {
  for (let order = 0; order < DEFAULT_SPOTS; order += 1) {
    await pool.execute(
      "INSERT INTO battle_spot (base_id, name, description, sort_order, is_active, created_at) " +
        "VALUES (?, ?, '', ?, 1, ?)",
      [baseId, `${order + 1}번 자리`, order, now],
    );
  }
}

export interface BattleBase {
  id: string;
  regionId: string;
  name: string;
  isActive: boolean;
  hasMap: boolean;
  /** 사진이나 설명이 하나라도 채워진 자리 수. 목록에서 "아직 비었다"를 보여 준다. */
  filledSpots: number;
  spotCount: number;
  commentCount: number;
}

export interface BattleRegion {
  id: string;
  name: string;
  isActive: boolean;
  bases: BattleBase[];
}

/** 지역 > 거점 목록. 관리자는 내려 둔 것까지 본다. */
export async function getBattleBoard(includeInactive: boolean): Promise<BattleRegion[]> {
  const [regionRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, is_active FROM battle_region " +
      (includeInactive ? "" : "WHERE is_active = 1 ") +
      "ORDER BY sort_order, id",
  );
  if (regionRows.length === 0) return [];

  /* 거점·자리·댓글을 거점 목록 한 번으로 모은다. 지역마다 따로 물으면 거점
     12 개에 왕복이 12 번 붙는다. */
  const [baseRows] = await pool.query<RowDataPacket[]>(
    "SELECT b.id, b.region_id, b.name, b.is_active, b.map_key IS NOT NULL AS has_map, " +
      "  (SELECT COUNT(*) FROM battle_spot s WHERE s.base_id = b.id AND s.is_active = 1) AS spot_count, " +
      "  (SELECT COUNT(*) FROM battle_spot s WHERE s.base_id = b.id AND s.is_active = 1 " +
      "     AND (s.description <> '' OR s.image_key IS NOT NULL)) AS filled_spots, " +
      "  (SELECT COUNT(*) FROM battle_comment c WHERE c.base_id = b.id AND c.removed_at IS NULL) AS comment_count " +
      "FROM battle_base b " +
      (includeInactive ? "" : "WHERE b.is_active = 1 ") +
      "ORDER BY b.sort_order, b.id",
  );

  return regionRows.map((region) => ({
    id: String(region.id),
    name: region.name as string,
    isActive: region.is_active === 1,
    bases: baseRows
      .filter((base) => String(base.region_id) === String(region.id))
      .map((base) => ({
        id: String(base.id),
        regionId: String(base.region_id),
        name: base.name as string,
        isActive: base.is_active === 1,
        hasMap: Number(base.has_map) === 1,
        spotCount: Number(base.spot_count),
        filledSpots: Number(base.filled_spots),
        commentCount: Number(base.comment_count),
      })),
  }));
}

export interface BattleSpot {
  id: string;
  name: string;
  description: string;
  imageKey: string | null;
  /** 로그인 없이도 볼 수 있는 사진인지. 기본은 거짓. */
  imagePublic: boolean;
  isActive: boolean;
  updatedAt: Date | null;
}

export interface BattleBaseDetail {
  id: string;
  name: string;
  isActive: boolean;
  mapKey: string | null;
  mapPublic: boolean;
  regionId: string;
  regionName: string;
  spots: BattleSpot[];
}

export async function getBaseDetail(
  baseId: string,
  includeInactive: boolean,
): Promise<BattleBaseDetail | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT b.id, b.name, b.is_active, b.map_key, b.map_public, r.id AS region_id, r.name AS region_name " +
      "FROM battle_base b JOIN battle_region r ON r.id = b.region_id WHERE b.id = ?",
    [baseId],
  );
  if (rows.length === 0) return null;
  const base = rows[0];
  if (base.is_active !== 1 && !includeInactive) return null;

  const [spotRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name, description, image_key, image_public, is_active, updated_at FROM battle_spot " +
      "WHERE base_id = ? " +
      (includeInactive ? "" : "AND is_active = 1 ") +
      "ORDER BY sort_order, id",
    [baseId],
  );

  return {
    id: String(base.id),
    name: base.name as string,
    isActive: base.is_active === 1,
    mapKey: (base.map_key as string | null) ?? null,
    mapPublic: base.map_public === 1,
    regionId: String(base.region_id),
    regionName: base.region_name as string,
    spots: spotRows.map((spot) => ({
      id: String(spot.id),
      name: spot.name as string,
      description: spot.description as string,
      imageKey: (spot.image_key as string | null) ?? null,
      imagePublic: spot.image_public === 1,
      isActive: spot.is_active === 1,
      updatedAt: (spot.updated_at as Date | null) ?? null,
    })),
  };
}

/* ── 관리자가 고치는 것 ─────────────────────────────────────── */

export async function renameRegion(regionId: string, name: string): Promise<void> {
  await pool.execute("UPDATE battle_region SET name = ? WHERE id = ?", [name, regionId]);
}

export async function setRegionActive(regionId: string, active: boolean): Promise<void> {
  await pool.execute("UPDATE battle_region SET is_active = ? WHERE id = ?", [active ? 1 : 0, regionId]);
}

export async function addRegion(name: string): Promise<string> {
  const [order] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM battle_region",
  );
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO battle_region (name, sort_order, is_active, created_at) VALUES (?, ?, 1, ?)",
    [name, Number(order[0].next), new Date()],
  );
  return String(result.insertId);
}

export async function renameBase(baseId: string, name: string): Promise<void> {
  await pool.execute("UPDATE battle_base SET name = ? WHERE id = ?", [name, baseId]);
}

export async function setBaseActive(baseId: string, active: boolean): Promise<void> {
  await pool.execute("UPDATE battle_base SET is_active = ? WHERE id = ?", [active ? 1 : 0, baseId]);
}

/** 거점을 새로 만들면 자리 네 칸도 같이 깔린다. 빈 거점은 쓸 일이 없다. */
export async function addBase(regionId: string, name: string): Promise<string> {
  const now = new Date();
  const [order] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM battle_base WHERE region_id = ?",
    [regionId],
  );
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO battle_base (region_id, name, sort_order, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
    [regionId, name, Number(order[0].next), now],
  );
  await insertDefaultSpots(String(result.insertId), now);
  return String(result.insertId);
}

export async function updateSpot(
  spotId: string,
  fields: { name: string; description: string },
  editorId: string,
): Promise<void> {
  await pool.execute(
    "UPDATE battle_spot SET name = ?, description = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    [fields.name, fields.description, new Date(), editorId, spotId],
  );
}

export async function setSpotActive(spotId: string, active: boolean): Promise<void> {
  await pool.execute("UPDATE battle_spot SET is_active = ? WHERE id = ?", [active ? 1 : 0, spotId]);
}

export async function addSpot(baseId: string, name: string): Promise<string> {
  const [order] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM battle_spot WHERE base_id = ?",
    [baseId],
  );
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO battle_spot (base_id, name, description, sort_order, is_active, created_at) " +
      "VALUES (?, ?, '', ?, 1, ?)",
    [baseId, name, Number(order[0].next), new Date()],
  );
  return String(result.insertId);
}

/* ── 댓글 ───────────────────────────────────────────────────── */

export interface BattleComment {
  id: string;
  userId: string;
  /*
   * 지금 쓰는 이름이다. 닉네임은 표에도 찍어 두지만, 보여 줄 때는 유저 표에서
   * 다시 읽는다 — 누가 누군지 알아보려고 다는 얼굴과 직업인데 이름만 옛것이면
   * 오히려 헷갈린다. 연맹을 나가 유저가 사라진 사람만 찍어 둔 이름으로 남는다.
   */
  nickname: string;
  avatarUrl: string | null;
  className: string | null;
  classType: ClassType | null;
  /** 지운 댓글이면 빈 문자열. 내용은 표에 남아 있지만 화면까지 내보내지 않는다. */
  body: string;
  createdAt: Date;
  /** 고친 적이 있으면 그 시각. 화면에 "수정됨"을 붙이는 근거다. */
  updatedAt: Date | null;
  removedAt: Date | null;
  /** 지운 사람이 글쓴이 자신이 아니라 관리자였는지. */
  removedByAdmin: boolean;
}

export async function getComments(baseId: string): Promise<BattleComment[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT c.id, c.user_id, c.nickname, c.body, c.created_at, c.updated_at, c.removed_at, c.removed_by, " +
      "  u.user_nickname, u.user_discord_id, u.discord_avatar, cc.name AS class_name, cc.type AS class_type " +
      "FROM battle_comment c " +
      // 연맹을 나간 사람의 댓글도 남아야 하므로 전부 LEFT JOIN 이다.
      "LEFT JOIN user u ON u.id = c.user_id " +
      "LEFT JOIN user_character_class_map m ON m.user_id = c.user_id " +
      "LEFT JOIN character_class cc ON cc.id = m.character_class_id " +
      "WHERE c.base_id = ? ORDER BY c.created_at, c.id",
    [baseId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: (row.user_nickname as string | null) ?? (row.nickname as string),
    avatarUrl: row.user_discord_id
      ? avatarUrl(row.user_discord_id as string, (row.discord_avatar as string | null) ?? null)
      : null,
    className: (row.class_name as string | null) ?? null,
    classType: (row.class_type as ClassType | null) ?? null,
    body: row.removed_at ? "" : (row.body as string),
    createdAt: row.created_at as Date,
    updatedAt: (row.updated_at as Date | null) ?? null,
    removedAt: (row.removed_at as Date | null) ?? null,
    removedByAdmin: row.removed_at !== null && String(row.removed_by) !== String(row.user_id),
  }));
}

export async function addComment(
  baseId: string,
  author: { userId: string; nickname: string },
  body: string,
): Promise<void> {
  await pool.execute(
    "INSERT INTO battle_comment (base_id, user_id, nickname, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [baseId, author.userId, author.nickname, body, new Date()],
  );
}

interface CommentOwner {
  baseId: string;
  userId: string;
  body: string;
  removedAt: Date | null;
}

async function loadComment(commentId: string): Promise<CommentOwner | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT base_id, user_id, body, removed_at FROM battle_comment WHERE id = ?",
    [commentId],
  );
  if (rows.length === 0) return null;
  return {
    baseId: String(rows[0].base_id),
    userId: String(rows[0].user_id),
    body: rows[0].body as string,
    removedAt: (rows[0].removed_at as Date | null) ?? null,
  };
}

/* 고치기·지우기는 바뀌기 직전의 글을 먼저 적고 나서 바꾼다. 이력이 없으면
   "누가 뭘 썼다가 지웠다"는 말만 남고 무엇을 썼는지는 아무도 모른다. */
async function logComment(
  commentId: string,
  action: "edit" | "remove" | "restore",
  bodyBefore: string,
  actor: { userId: string; nickname: string },
): Promise<void> {
  await pool.execute(
    "INSERT INTO battle_comment_log (comment_id, action, body_before, actor_id, actor_nickname, logged_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
    [commentId, action, bodyBefore, actor.userId, actor.nickname, new Date()],
  );
}

export type CommentEditResult = "ok" | "missing" | "forbidden" | "removed";

export async function editComment(
  commentId: string,
  actor: { userId: string; nickname: string; isAdmin: boolean },
  body: string,
): Promise<CommentEditResult> {
  const comment = await loadComment(commentId);
  if (!comment) return "missing";
  if (comment.removedAt) return "removed";
  // 고치는 것은 글쓴이만 한다. 관리자도 남의 글을 고쳐 쓰지는 못한다 —
  // 지우는 것과 달리 고치기는 하지 않은 말을 한 것으로 만들 수 있다.
  if (comment.userId !== actor.userId) return "forbidden";
  await logComment(commentId, "edit", comment.body, actor);
  await pool.execute("UPDATE battle_comment SET body = ?, updated_at = ? WHERE id = ?", [
    body,
    new Date(),
    commentId,
  ]);
  return "ok";
}

export async function removeComment(
  commentId: string,
  actor: { userId: string; nickname: string; isAdmin: boolean },
): Promise<CommentEditResult> {
  const comment = await loadComment(commentId);
  if (!comment) return "missing";
  if (comment.removedAt) return "ok";
  if (comment.userId !== actor.userId && !actor.isAdmin) return "forbidden";
  await logComment(commentId, "remove", comment.body, actor);
  await pool.execute("UPDATE battle_comment SET removed_at = ?, removed_by = ? WHERE id = ?", [
    new Date(),
    actor.userId,
    commentId,
  ]);
  return "ok";
}

export interface CommentLogRow {
  id: string;
  action: "edit" | "remove" | "restore";
  bodyBefore: string;
  actorNickname: string;
  loggedAt: Date;
}

/** 관리자가 한 댓글의 이력을 펼쳐 볼 때 쓴다. */
export async function getCommentLog(commentId: string): Promise<CommentLogRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, action, body_before, actor_nickname, logged_at FROM battle_comment_log " +
      "WHERE comment_id = ? ORDER BY logged_at, id",
    [commentId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    action: row.action as CommentLogRow["action"],
    bodyBefore: row.body_before as string,
    actorNickname: row.actor_nickname as string,
    loggedAt: row.logged_at as Date,
  }));
}

/** 지운 댓글의 원문. 관리자만 본다. */
export async function getRemovedBody(commentId: string): Promise<string | null> {
  const comment = await loadComment(commentId);
  return comment?.body ?? null;
}

/* ── 아주 지우기 ────────────────────────────────────────────── */

/*
 * 내리기와 달리 행까지 없앤다. 잘못 만든 것, 시험 삼아 넣어 본 것을 치우는
 * 용도다. 기록으로 남길 값이 있으면 내리기를 쓴다.
 *
 * 외래 키를 걸지 않았으므로 딸린 것을 손으로 지운다. 거점만 지우면 그 밑의
 * 자리와 댓글이 주인 없이 남아, 나중에 같은 번호가 다시 나면 엉뚱한 거점에
 * 옛날 댓글이 붙는다.
 */
async function deleteBasesIn(
  connection: mysql.PoolConnection,
  baseIds: string[],
): Promise<string[]> {
  if (baseIds.length === 0) return [];
  const marks = baseIds.map(() => "?").join(",");
  /* 행을 지우기 전에 사진 열쇠를 먼저 챙긴다. 지운 뒤에는 무엇이 있었는지
     알 수 없고, 그러면 R2 에 주인 없는 파일이 영영 남는다. */
  const [shots] = await connection.query<RowDataPacket[]>(
    `SELECT image_key AS k FROM battle_spot WHERE base_id IN (${marks}) AND image_key IS NOT NULL ` +
      `UNION ALL SELECT map_key AS k FROM battle_base WHERE id IN (${marks}) AND map_key IS NOT NULL`,
    [...baseIds, ...baseIds],
  );
  await connection.execute(
    `DELETE l FROM battle_comment_log l JOIN battle_comment c ON c.id = l.comment_id WHERE c.base_id IN (${marks})`,
    baseIds,
  );
  await connection.execute(`DELETE FROM battle_comment WHERE base_id IN (${marks})`, baseIds);
  await connection.execute(`DELETE FROM battle_spot WHERE base_id IN (${marks})`, baseIds);
  await connection.execute(`DELETE FROM battle_base WHERE id IN (${marks})`, baseIds);
  return shots.map((row) => row.k as string);
}

async function inTransaction<T>(
  work: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** 지운 자리들이 쓰던 사진 열쇠를 돌려준다. 부르는 쪽이 R2 에서도 지운다. */
export async function deleteRegion(regionId: string): Promise<string[]> {
  return inTransaction(async (connection) => {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM battle_base WHERE region_id = ?",
      [regionId],
    );
    const keys = await deleteBasesIn(connection, rows.map((row) => String(row.id)));
    await connection.execute("DELETE FROM battle_region WHERE id = ?", [regionId]);
    return keys;
  });
}

export async function deleteBase(baseId: string): Promise<string[]> {
  return inTransaction((connection) => deleteBasesIn(connection, [baseId]));
}

export async function deleteSpot(spotId: string): Promise<string | null> {
  const key = await spotImageKey(spotId);
  await pool.execute("DELETE FROM battle_spot WHERE id = ?", [spotId]);
  return key;
}

/* ── 자리 사진 ──────────────────────────────────────────────── */

async function spotImageKey(spotId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT image_key FROM battle_spot WHERE id = ?",
    [spotId],
  );
  return (rows[0]?.image_key as string | null) ?? null;
}

/**
 * 새 사진을 자리에 매단다. 앞서 쓰던 열쇠를 돌려주므로 부르는 쪽이 R2 에서
 * 옛 파일을 지울 수 있다.
 */
export async function setSpotImage(
  spotId: string,
  key: string,
  contentType: string,
  isPublic: boolean,
): Promise<string | null> {
  const previous = await spotImageKey(spotId);
  await pool.execute(
    "UPDATE battle_spot SET image_key = ?, image_type = ?, image_public = ? WHERE id = ?",
    [key, contentType, isPublic ? 1 : 0, spotId],
  );
  return previous === key ? null : previous;
}

export async function clearSpotImage(spotId: string): Promise<string | null> {
  const previous = await spotImageKey(spotId);
  await pool.execute(
    "UPDATE battle_spot SET image_key = NULL, image_type = NULL, image_public = 0 WHERE id = ?",
    [spotId],
  );
  return previous;
}

export async function setSpotImagePublic(spotId: string, isPublic: boolean): Promise<void> {
  await pool.execute("UPDATE battle_spot SET image_public = ? WHERE id = ?", [
    isPublic ? 1 : 0,
    spotId,
  ]);
}

/** 보관함에 있는 사진 하나. 자리 사진이든 거점 지도든 같은 모양이다. */
export interface StoredImage {
  key: string;
  contentType: string;
  isPublic: boolean;
}

/** 사진을 내주는 길에서 쓴다. 로그인을 물을지 여기 적힌 공개 여부로 정한다. */
export async function getSpotImage(spotId: string): Promise<StoredImage | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT image_key, image_type, image_public FROM battle_spot WHERE id = ?",
    [spotId],
  );
  const row = rows[0];
  if (!row?.image_key) return null;
  return {
    key: row.image_key as string,
    contentType: (row.image_type as string | null) ?? "image/webp",
    isPublic: row.image_public === 1,
  };
}

/** 지운 댓글까지 표에서 없앤다. 이력도 함께 사라진다. */
export async function purgeComment(commentId: string): Promise<void> {
  await inTransaction(async (connection) => {
    await connection.execute("DELETE FROM battle_comment_log WHERE comment_id = ?", [commentId]);
    await connection.execute("DELETE FROM battle_comment WHERE id = ?", [commentId]);
  });
}

/**
 * 이 거점이 속한 지역 번호. 사진을 보관함에 넣을 때 폴더 경로로 쓴다.
 *
 * 화면에서 받은 값을 그대로 경로에 넣지 않는다 — 어디에 저장할지는 서버가
 * 정해야 한다. 지역·거점 이름은 바뀔 수 있어 번호를 쓴다.
 */
export async function baseRegionId(baseId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT region_id FROM battle_base WHERE id = ?",
    [baseId],
  );
  return rows[0] ? String(rows[0].region_id) : null;
}

/* ── 거점 지도 ──────────────────────────────────────────────── */

async function baseMapKey(baseId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT map_key FROM battle_base WHERE id = ?", [
    baseId,
  ]);
  return (rows[0]?.map_key as string | null) ?? null;
}

/** 새 지도를 매단다. 앞서 쓰던 열쇠를 돌려주므로 부르는 쪽이 옛 파일을 지운다. */
export async function setBaseMap(
  baseId: string,
  key: string,
  contentType: string,
  isPublic: boolean,
): Promise<string | null> {
  const previous = await baseMapKey(baseId);
  await pool.execute(
    "UPDATE battle_base SET map_key = ?, map_type = ?, map_public = ? WHERE id = ?",
    [key, contentType, isPublic ? 1 : 0, baseId],
  );
  return previous === key ? null : previous;
}

export async function clearBaseMap(baseId: string): Promise<string | null> {
  const previous = await baseMapKey(baseId);
  await pool.execute(
    "UPDATE battle_base SET map_key = NULL, map_type = NULL, map_public = 0 WHERE id = ?",
    [baseId],
  );
  return previous;
}

export async function setBaseMapPublic(baseId: string, isPublic: boolean): Promise<void> {
  await pool.execute("UPDATE battle_base SET map_public = ? WHERE id = ?", [isPublic ? 1 : 0, baseId]);
}

export async function getBaseMap(baseId: string): Promise<StoredImage | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT map_key, map_type, map_public FROM battle_base WHERE id = ?",
    [baseId],
  );
  const row = rows[0];
  if (!row?.map_key) return null;
  return {
    key: row.map_key as string,
    contentType: (row.map_type as string | null) ?? "image/webp",
    isPublic: row.map_public === 1,
  };
}
