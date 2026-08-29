import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { getUserByDiscordId } from "@/lib/queries";
import { fetchIsGuildAdmin } from "@/lib/discordRoles";

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
      // account 는 최초 로그인 때만 온다. 역할은 그때 한 번 확인해 토큰에 담고,
      // 이후 요청에서는 DB 조회 없이 그 값을 쓴다.
      if (account?.access_token) {
        token.isAdmin = await fetchIsGuildAdmin(account.access_token);
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
