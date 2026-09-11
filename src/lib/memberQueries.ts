import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { ensureColumn } from "@/lib/schema";

/*
 * 추첨에 넣을 사람을 이름으로 찾고, 그 사람의 얼굴을 함께 보여주기 위한 조회.
 *
 * 얼굴은 두 갈래다. 디스코드로 로그인한 적이 있으면 그때 받아 둔 사진을 쓰고,
 * 없으면 디스코드가 아이디마다 정해 주는 기본 그림을 쓴다. 기본 그림은 바깥에
 * 물어볼 것 없이 아이디만으로 계산된다 — 웹 앱에는 봇 토큰이 없어서 서버
 * 구성원 전체의 사진을 긁어올 방법이 없다.
 */
export async function ensureMemberProfileColumn(): Promise<void> {
  await ensureColumn("user", "discord_avatar", "varchar(64) NULL");
}

/** 사진을 올리지 않았거나, 우리가 아직 한 번도 본 적 없는 사람. */
export function defaultAvatarUrl(discordId: string): string {
  try {
    // 22 비트를 버리면 남는 것이 디스코드가 기본 그림을 고르는 값이다.
    // tsconfig 의 target 이 ES2020 아래라 BigInt 리터럴(22n)을 쓸 수 없다.
    const shifted = BigInt(discordId) / BigInt(2) ** BigInt(22);
    return `https://cdn.discordapp.com/embed/avatars/${shifted % BigInt(6)}.png`;
  } catch {
    // 숫자가 아닌 아이디는 있을 수 없지만, 얼굴 하나 때문에 화면이 죽지 않게 한다.
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

export function avatarUrl(discordId: string, hash: string | null): string {
  if (!hash) return defaultAvatarUrl(discordId);
  // a_ 로 시작하면 움직이는 사진이다.
  return `https://cdn.discordapp.com/avatars/${discordId}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=64`;
}

/*
 * 로그인할 때 한 번 적어 둔다. 매 요청마다 쓰면 로그인한 사람 수만큼 쓰기가
 * 늘어나므로, 디스코드가 프로필을 함께 주는 최초 로그인에서만 부른다.
 */
export async function rememberDiscordAvatar(discordId: string, hash: string | null): Promise<void> {
  try {
    await pool.execute(
      "UPDATE user SET discord_avatar = ? WHERE user_discord_id = ? AND (discord_avatar IS NULL OR discord_avatar <> ?)",
      [hash, discordId, hash],
    );
  } catch {
    // 얼굴을 못 적었다고 로그인이 막히면 안 된다.
  }
}

export interface MemberSuggestion {
  id: string;
  nickname: string;
  guildName: string | null;
  avatarUrl: string;
}

function toSuggestion(row: RowDataPacket): MemberSuggestion {
  return {
    id: String(row.id),
    nickname: row.user_nickname as string,
    guildName: (row.guild_name as string | null) ?? null,
    avatarUrl: avatarUrl(row.user_discord_id as string, (row.discord_avatar as string | null) ?? null),
  };
}

const MEMBER_SELECT =
  "SELECT u.id, u.user_nickname, u.user_discord_id, u.discord_avatar, g.name AS guild_name " +
  "FROM user u LEFT JOIN guild g ON g.id = u.guild_id " +
  "WHERE u.status = 1";

/** 이름 조각으로 찾는다. 빈 글자면 앞에서부터 조금만 보여 준다. */
export async function searchMembers(query: string, limit = 20): Promise<MemberSuggestion[]> {
  const trimmed = query.trim();
  const [rows] = trimmed
    ? await pool.query<RowDataPacket[]>(
        `${MEMBER_SELECT} AND u.user_nickname LIKE ? ORDER BY u.user_nickname ASC LIMIT ?`,
        [`%${trimmed}%`, limit],
      )
    : await pool.query<RowDataPacket[]>(`${MEMBER_SELECT} ORDER BY u.user_nickname ASC LIMIT ?`, [limit]);
  return rows.map(toSuggestion);
}

/*
 * 여러 줄 붙여넣기용. 이름이 정확히 맞는 사람만 찾아 주고 못 찾은 이름은
 * 그대로 돌려준다. 40 분 안에 급히 넣는 명단이라 어디가 틀렸는지 바로 보여야 한다.
 */
export async function matchMembersByNickname(
  names: string[],
): Promise<{ matched: MemberSuggestion[]; missing: string[] }> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!wanted.length) return { matched: [], missing: [] };
  const [rows] = await pool.query<RowDataPacket[]>(
    `${MEMBER_SELECT} AND u.user_nickname IN (${wanted.map(() => "?").join(", ")})`,
    wanted,
  );
  const matched = rows.map(toSuggestion);
  const found = new Set(matched.map((m) => m.nickname));
  return { matched, missing: wanted.filter((name) => !found.has(name)) };
}
