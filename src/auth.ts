import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { getUserByDiscordId } from "@/lib/queries";
import { rememberDiscordAvatar } from "@/lib/memberQueries";
import { fetchIsGuildAdmin } from "@/lib/discordRoles";

/*
 * 세션 판. 올리면 그 전에 발급된 세션은 다음 요청에서 풀려 로그인 화면으로 간다.
 * 세션이 들어올 때마다 연장돼 자주 오는 사람은 로그아웃될 일이 없으므로, 로그인
 * 때만 받을 수 있는 정보를 모두에게서 새로 받아야 할 때 쓴다.
 *
 * 2 — 프로필 사진을 로그인할 때 적게 되면서, 그 전부터 로그인해 둔 사람들의 사진을
 *     채우려고 한 번 다시 로그인하게 했다.
 */
const SESSION_VERSION = 2;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // guilds.members.read 는 관리자 메뉴 노출 여부를 디스코드 역할로 판단하기
      // 위해 필요하다. 추가 시점부터 기존 사용자도 동의 화면을 한 번 더 본다.
      authorization: {
        params: { scope: "identify email guilds.members.read" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id) return false;
      // Only members already registered via the bot's #회원등록 command
      // (user.status = 1) may sign in — same gate as get_user_data().
      const dbUser = await getUserByDiscordId(profile.id as string);
      if (!dbUser) return "/login?error=unregistered";
      return true;
    },
    async jwt({ token, profile, account }) {
      // 로그인할 때 판을 찍는다. 판이 다른 세션은 null 을 돌려주면 쿠키가 지워진다.
      if (profile?.id) token.sessionVersion = SESSION_VERSION;
      else if (token.sessionVersion !== SESSION_VERSION) return null;

      // account 는 최초 로그인 때만 온다. 역할은 그때 한 번 확인해 토큰에 담고,
      // 이후 요청에서는 DB 조회 없이 그 값을 쓴다.
      if (account?.access_token) {
        token.isAdmin = await fetchIsGuildAdmin(account.access_token);
      }

      /*
       * 프로필 사진은 로그인할 때만 디스코드가 알려 준다. 추첨 화면에서 이름
       * 옆에 얼굴을 보여주려면 어딘가 적어 두어야 하므로 이때 한 번 적는다.
       * 웹 앱에는 봇 토큰이 없어 나중에 따로 물어볼 방법이 없다.
       */
      if (profile?.id) {
        const avatar = (profile as { avatar?: string | null }).avatar ?? null;
        await rememberDiscordAvatar(profile.id as string, avatar);
      }

      const discordId = (profile?.id as string | undefined) ?? (token.discordId as string | undefined);
      if (discordId) {
        const dbUser = await getUserByDiscordId(discordId);
        if (dbUser) {
          token.dbUserId = dbUser.id;
          token.discordId = dbUser.user_discord_id;
          token.nickname = dbUser.user_nickname;
          token.guildId = dbUser.guild_id;
          token.permission = dbUser.permission;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.dbUserId) {
        session.user.dbUserId = token.dbUserId as string;
        session.user.discordId = token.discordId as string;
        session.user.nickname = token.nickname as string;
        session.user.guildId = token.guildId as string;
        session.user.permission = token.permission as string;
        session.user.isAdmin = token.isAdmin === true;
      }
      return session;
    },
  },
});
