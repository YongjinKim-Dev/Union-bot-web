"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/adminAuth";
import {
  addBase,
  addComment,
  addRegion,
  addSpot,
  deleteBase,
  deleteRegion,
  deleteSpot,
  editComment,
  getCommentLog,
  getRemovedBody,
  purgeComment,
  removeComment,
  renameBase,
  renameRegion,
  setBaseActive,
  setRegionActive,
  setSpotActive,
  updateSpot,
  type CommentLogRow,
} from "@/lib/battleQueries";

const NAME_MAX = 40;
const SPOT_NAME_MAX = 60;
const DESCRIPTION_MAX = 500;
const COMMENT_MAX = 1000;

/* 화면에서 이미 막고 있어도 서버 액션은 URL 만 알면 직접 불릴 수 있다.
   길이는 표의 칸 크기이기도 해서, 넘겨서 잘리기 전에 여기서 돌려보낸다. */
function trimTo(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/* ── 관리자: 지역·거점·자리 ─────────────────────────────────── */

export async function renameRegionAction(regionId: string, name: string) {
  await requireAdmin();
  const trimmed = trimTo(name, NAME_MAX);
  if (!trimmed) throw new Error("지역 이름을 적어 주세요.");
  await renameRegion(regionId, trimmed);
  revalidatePath("/battle");
}

export async function setRegionActiveAction(regionId: string, active: boolean) {
  await requireAdmin();
  await setRegionActive(regionId, active);
  revalidatePath("/battle");
}

export async function addRegionAction(name: string) {
  await requireAdmin();
  const trimmed = trimTo(name, NAME_MAX);
  if (!trimmed) throw new Error("지역 이름을 적어 주세요.");
  await addRegion(trimmed);
  revalidatePath("/battle");
}

export async function renameBaseAction(baseId: string, name: string) {
  await requireAdmin();
  const trimmed = trimTo(name, NAME_MAX);
  if (!trimmed) throw new Error("거점 이름을 적어 주세요.");
  await renameBase(baseId, trimmed);
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

export async function setBaseActiveAction(baseId: string, active: boolean) {
  await requireAdmin();
  await setBaseActive(baseId, active);
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

/*
 * 내리기와 삭제는 다른 일이다. 내린 것은 목록에서만 빠지고 기록으로 남지만,
 * 삭제는 딸린 자리와 댓글까지 함께 없앤다. 되돌릴 수 없으므로 화면에서 한 번
 * 더 묻는다.
 */
export async function deleteRegionAction(regionId: string) {
  await requireAdmin();
  await deleteRegion(regionId);
  revalidatePath("/battle");
}

export async function deleteBaseAction(baseId: string) {
  await requireAdmin();
  await deleteBase(baseId);
  revalidatePath("/battle");
}

export async function addBaseAction(regionId: string, name: string) {
  await requireAdmin();
  const trimmed = trimTo(name, NAME_MAX);
  if (!trimmed) throw new Error("거점 이름을 적어 주세요.");
  await addBase(regionId, trimmed);
  revalidatePath("/battle");
}

export async function saveSpotAction(
  baseId: string,
  spotId: string,
  name: string,
  description: string,
) {
  const admin = await requireAdmin();
  const trimmedName = trimTo(name, SPOT_NAME_MAX);
  if (!trimmedName) throw new Error("자리 이름을 적어 주세요.");
  await updateSpot(
    spotId,
    { name: trimmedName, description: trimTo(description, DESCRIPTION_MAX) },
    admin.dbUserId,
  );
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

export async function setSpotActiveAction(baseId: string, spotId: string, active: boolean) {
  await requireAdmin();
  await setSpotActive(spotId, active);
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

export async function deleteSpotAction(baseId: string, spotId: string) {
  await requireAdmin();
  await deleteSpot(spotId);
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

export async function addSpotAction(baseId: string, name: string) {
  await requireAdmin();
  const trimmed = trimTo(name, SPOT_NAME_MAX);
  if (!trimmed) throw new Error("자리 이름을 적어 주세요.");
  await addSpot(baseId, trimmed);
  revalidatePath(`/battle/${baseId}`);
}

/* ── 길드원: 댓글 ───────────────────────────────────────────── */

export type CommentActionResult = { ok: true } | { ok: false; message: string };

/*
 * 투표와 같은 이유로 throw 대신 반환값으로 돌려준다. 프로덕션 빌드에서는
 * throw 한 메시지가 클라이언트까지 오지 않고 영문 오류 코드로 바뀐다.
 */
async function member() {
  const session = await auth();
  if (!session?.user?.dbUserId) return null;
  return {
    userId: session.user.dbUserId,
    nickname: session.user.nickname ?? session.user.name ?? "이름 없음",
    isAdmin: session.user.isAdmin === true,
  };
}

export async function addCommentAction(
  baseId: string,
  body: string,
): Promise<CommentActionResult> {
  const who = await member();
  if (!who) return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  const trimmed = trimTo(body, COMMENT_MAX);
  if (!trimmed) return { ok: false, message: "댓글을 적어 주세요." };
  await addComment(baseId, who, trimmed);
  revalidatePath(`/battle/${baseId}`);
  return { ok: true };
}

export async function editCommentAction(
  baseId: string,
  commentId: string,
  body: string,
): Promise<CommentActionResult> {
  const who = await member();
  if (!who) return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  const trimmed = trimTo(body, COMMENT_MAX);
  if (!trimmed) return { ok: false, message: "댓글을 적어 주세요." };
  const result = await editComment(commentId, who, trimmed);
  if (result === "missing") return { ok: false, message: "없는 댓글입니다." };
  if (result === "removed") return { ok: false, message: "지운 댓글은 고칠 수 없습니다." };
  if (result === "forbidden") return { ok: false, message: "자기가 쓴 댓글만 고칠 수 있습니다." };
  revalidatePath(`/battle/${baseId}`);
  return { ok: true };
}

export async function removeCommentAction(
  baseId: string,
  commentId: string,
): Promise<CommentActionResult> {
  const who = await member();
  if (!who) return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  const result = await removeComment(commentId, who);
  if (result === "missing") return { ok: false, message: "없는 댓글입니다." };
  if (result === "forbidden") return { ok: false, message: "자기가 쓴 댓글만 지울 수 있습니다." };
  revalidatePath(`/battle/${baseId}`);
  return { ok: true };
}

/** 댓글을 이력까지 아주 없앤다. 관리자만 한다. */
export async function purgeCommentAction(baseId: string, commentId: string) {
  await requireAdmin();
  await purgeComment(commentId);
  revalidatePath(`/battle/${baseId}`);
}

export interface CommentHistory {
  removedBody: string | null;
  rows: CommentLogRow[];
}

/** 이력은 관리자만 본다. 지운 원문이 여기로 나가므로 권한을 다시 확인한다. */
export async function commentHistoryAction(commentId: string): Promise<CommentHistory> {
  await requireAdmin();
  const [rows, removedBody] = await Promise.all([
    getCommentLog(commentId),
    getRemovedBody(commentId),
  ]);
  return { rows, removedBody };
}
