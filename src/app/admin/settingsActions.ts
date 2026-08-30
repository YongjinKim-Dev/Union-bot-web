"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { type AutoRule, saveAutoRule } from "@/lib/settings";
import { rebuildAutoQueue } from "@/lib/surveyQueue";

/* 서버 액션은 URL 만 알면 직접 호출될 수 있으므로 매번 역할을 확인한다. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.dbUserId) throw new Error("로그인이 필요합니다.");
  if (!session.user.isAdmin) throw new Error("권한이 없습니다.");
  return session.user;
}

/* 규칙을 저장하고 그 자리에서 예정 큐를 새 규칙대로 다시 채운다. */
export async function saveAutoRuleAction(rule: AutoRule) {
  await requireAdmin();

  if (rule.announceMinutes < 0 || !/^\d{2}:\d{2}$/.test(rule.battleTime) || !/^\d{2}:\d{2}$/.test(rule.openTime)) {
    throw new Error("규칙 값이 올바르지 않습니다.");
  }

  const now = new Date();
  await saveAutoRule(rule, now);
  await rebuildAutoQueue(now);
  revalidatePath("/admin");
}
