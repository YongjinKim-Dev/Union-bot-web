"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { type DrawEntry, isValidSeed, randomSeed, runDraw } from "@/lib/draw";
import { type MemberSuggestion, searchMembers } from "@/lib/memberQueries";
import { type DrawRow, getDrawEntries, getDraws, saveDraw } from "@/lib/drawQueries";

export async function searchMembersAction(query: string): Promise<MemberSuggestion[]> {
  await requireAdmin();
  return searchMembers(query, 12);
}

export async function fetchDrawsAction(): Promise<DrawRow[]> {
  await requireAdmin();
  return getDraws();
}

export async function fetchDrawEntriesAction(drawId: string) {
  await requireAdmin();
  return getDrawEntries(drawId);
}

export type SaveDrawResponse = { ok: true; id: string } | { ok: false; message: string };

/*
 * 뽑는 일은 서버에서 한다. 화면이 결과를 만들어 보내면, 마음에 드는 결과가 나올
 * 때까지 다시 돌려 보고 그중 하나만 저장할 수 있다. 씨앗과 명단을 받아 여기서
 * 뽑고 그대로 남긴다.
 */
export async function saveDrawAction(input: {
  title: string;
  surveyId: string | null;
  seed: string;
  pickCount: number;
  entries: DrawEntry[];
}): Promise<SaveDrawResponse> {
  const admin = await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, message: "추첨 이름을 적어 주세요." };
  if (!isValidSeed(input.seed)) return { ok: false, message: "씨앗이 올바르지 않습니다. 새로 뽑아 주세요." };
  if (input.entries.length < 2) return { ok: false, message: "참여자가 두 명 이상이어야 합니다." };
  if (input.pickCount < 1 || input.pickCount >= input.entries.length) {
    return { ok: false, message: "뽑을 인원은 1명 이상, 참여자 수보다 적어야 합니다." };
  }
  // 같은 사람이 두 번 들어가면 그 사람만 확률이 두 배가 된다.
  const names = new Set(input.entries.map((e) => e.nickname));
  if (names.size !== input.entries.length) {
    return { ok: false, message: "같은 사람이 두 번 들어 있습니다." };
  }

  const outcome = runDraw(input.entries, input.pickCount, input.seed);
  const id = await saveDraw(
    {
      title,
      surveyId: input.surveyId,
      mode: "ladder",
      seed: outcome.seed,
      pickCount: input.pickCount,
      entryCount: input.entries.length,
      drawnBy: admin.dbUserId,
    },
    outcome.order.map((entry, position) => ({
      userId: entry.userId,
      nickname: entry.nickname,
      position,
      isWinner: position < input.pickCount,
    })),
  );
  return { ok: true, id };
}

export async function newSeedAction(): Promise<string> {
  await requireAdmin();
  return randomSeed();
}
