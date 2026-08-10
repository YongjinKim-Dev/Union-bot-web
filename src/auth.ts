import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { getUserByDiscordId } from "@/lib/queries";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
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
    async jwt({ token, profile }) {
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
      }
      return session;
    },
  },
});
