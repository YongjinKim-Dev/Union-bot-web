import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      dbUserId: string;
      discordId: string;
      nickname: string;
      guildId: string;
      permission: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    dbUserId?: string;
    discordId?: string;
    nickname?: string;
    guildId?: string;
    permission?: string;
  }
}
