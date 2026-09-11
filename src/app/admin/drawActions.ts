"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { type DrawEntry, isValidSeed, randomSeed, replayDraw } from "@/lib/draw";
import { type MemberSuggestion, searchMembers } from "@/lib/memberQueries";
import { type DrawRow, getDrawEntries, getDraws, saveDraw } from "@/lib/drawQueries";

/*
 * 미리보기에 한 번에 내보내는 최대 인원. 40 분 안에 명단을 넣어야 하므로 이름을
 * 다 치지 않고 목록에서 고르는 일이 잦다 — 넉넉히 보내고, 넘치면 화면이 알린다.
 * "use server" 파일은 함수만 내보낼 수 있어 이 값은 밖으로 내지 않는다.
 */
const SUGGEST_LIMIT = 100;

export async function searchMembersAction(
  query: string,
): Promise<{ members: MemberSuggestion[]; capped: boolean }> {
  await requireAdmin();
  const rows = await searchMembers(query, SUGGEST_LIMIT + 1);
  return { members: rows.slice(0, SUGGEST_LIMIT), capped: rows.length > SUGGEST_LIMIT };
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
 * 씨앗과 자리 배치를 받아 서버가 직접 다시 돌린다. 화면이 보낸 당첨자를 그대로
 * 믿으면, 마음에 드는 결과가 나올 때까지 돌려 보고 하나만 남길 수 있다.
 */
export async function saveDrawAction(input: {
  title: string;
  surveyId: string | null;
  seed: string;
  pickCount: number;
  entries: DrawEntry[];
  /** 라운드마다 조마다의 열 순서(닉네임). */
  arrangements: string[][][];
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

  const replay = replayDraw(input.entries, input.pickCount, input.seed, input.arrangements);
  if (!replay) return { ok: false, message: "추첨을 다시 돌려 보니 결과가 맞지 않습니다. 남기지 않았습니다." };
  const wonNames = new Set(replay.winners.map((w) => w.nickname));
  const id = await saveDraw(
    {
      title,
      surveyId: input.surveyId,
      mode: "ladder",
      seed: input.seed,
      pickCount: input.pickCount,
      entryCount: input.entries.length,
      drawnBy: admin.dbUserId,
    },
    // 당첨자를 앞에 두고 나머지를 뒤에 둔다. 자리 번호는 그 순서다.
    [...replay.winners, ...input.entries.filter((e) => !wonNames.has(e.nickname))].map((entry, position) => ({
      userId: entry.userId,
      nickname: entry.nickname,
      position,
      isWinner: wonNames.has(entry.nickname),
    })),
  );
  return { ok: true, id };
}

export async function newSeedAction(): Promise<string> {
  await requireAdmin();
  return randomSeed();
}
