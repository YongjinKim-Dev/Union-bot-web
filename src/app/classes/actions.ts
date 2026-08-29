"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getCharacterClassesByType, setUserCharacterClass } from "@/lib/queries";
import type { ClassType } from "@/lib/types";

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    throw new Error("로그인이 필요합니다.");
  }
  return session.user;
}

export async function fetchClassesByType(type: ClassType) {
  return getCharacterClassesByType(type);
}

export async function registerCharacterClass(characterClassId: string) {
  const user = await requireSessionUser();
  await setUserCharacterClass(user.dbUserId, characterClassId);
  // The registered class is shown on the home card and the vote page too.
  revalidatePath("/");
  revalidatePath("/vote");
  revalidatePath("/classes");
}
