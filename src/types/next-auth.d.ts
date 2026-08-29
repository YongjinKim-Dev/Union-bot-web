import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      dbUserId: string;
      discordId: string;
      nickname: string;
      guildId: string;
      permission: string;
      /** 디스코드 부대장·대장 역할 보유 여부. 관리자 메뉴 노출에 쓴다. */
      isAdmin: boolean;
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
    isAdmin?: boolean;
  }
}
