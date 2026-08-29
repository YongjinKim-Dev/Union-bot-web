const ROLE_API = "https://discord.com/api/v10/users/@me/guilds";

/**
 * 로그인한 사람이 관리자 역할(부대장·대장)을 가지고 있는지.
 *
 * OAuth 의 guilds.members.read 권한으로 본인 길드 멤버 정보를 읽어 역할 ID 를
 * 대조한다. 실패하면 관리자가 아닌 것으로 본다 — 조회가 안 될 때 권한을 열어
 * 주는 쪽으로 기울면 안 된다.
 *
 * 역할은 로그인 시점에 한 번만 확인해 세션에 담긴다. 디스코드에서 역할을 바꾸면
 * 다시 로그인해야 반영된다.
 */
export async function fetchIsGuildAdmin(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!guildId || adminRoleIds.length === 0) return false;

  try {
    const res = await fetch(`${ROLE_API}/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const member = (await res.json()) as { roles?: string[] };
    return (member.roles ?? []).some((role) => adminRoleIds.includes(role));
  } catch {
    return false;
  }
}
