"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/adminAuth";
import { deleteObject, putObject, r2Configured } from "@/lib/r2";
import {
  addBase,
  addComment,
  addRegion,
  addSpot,
  clearSpotImage,
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
  setSpotImage,
  setSpotImagePublic,
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
  await dropObjects(await deleteRegion(regionId));
  revalidatePath("/battle");
}

export async function deleteBaseAction(baseId: string) {
  await requireAdmin();
  await dropObjects(await deleteBase(baseId));
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
  await dropObjects([await deleteSpot(spotId)]);
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

/* ── 자리 사진 ──────────────────────────────────────────────── */

/** 받아들이는 사진. 게임 스크린샷이므로 이 셋이면 충분하다. */
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** 올리기 전 원본 한도. 4K 스크린샷도 보통 이 아래다. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/* 자리 칸은 화면에서 500px 언저리로 그려진다. 2 배 화면까지 감안해 1600 이면
   넉넉하고, webp 로 바꾸면 장당 수백 KB 로 떨어진다. */
const MAX_IMAGE_WIDTH = 1600;

/*
 * DB 행은 지웠는데 R2 파일이 남으면 아무도 다시 찾지 못한다. 반대로 파일을
 * 못 지워도 화면은 멀쩡하므로, 지우기 실패로 작업 전체를 되돌리지는 않는다.
 */
async function dropObjects(keys: (string | null)[]): Promise<void> {
  if (!r2Configured()) return;
  for (const key of keys) {
    if (!key) continue;
    try {
      await deleteObject(key);
    } catch {
      // 남은 파일은 버킷 수명 규칙으로 치운다. 여기서 막을 일은 아니다.
    }
  }
}

/**
 * 자리에 사진을 올린다.
 *
 * isPublic 은 부르는 쪽이 정한다. 주지 않으면 차단이다 — 로그인한 사람만
 * 볼 수 있다. 공개로 켜면 주소를 아는 사람은 누구나 받을 수 있으므로,
 * 밖에 나가도 되는 사진에만 켠다.
 */
export async function uploadSpotImageAction(
  baseId: string,
  spotId: string,
  form: FormData,
  isPublic: boolean = false,
): Promise<CommentActionResult> {
  await requireAdmin();
  if (!r2Configured()) {
    return { ok: false, message: "사진 보관함이 아직 설정되지 않았습니다." };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "사진을 골라 주세요." };
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "PNG, JPG, WEBP 만 올릴 수 있습니다." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "사진이 너무 큽니다. 12MB 아래로 올려 주세요." };
  }

  /* 원본 그대로 두지 않는다. 4K 스크린샷은 장당 몇 MB 인데 화면에는 그 절반
     폭으로도 안 나온다. 좌표나 닉네임이 박힌 메타데이터도 여기서 떨어진다. */
  let body: Buffer;
  try {
    body = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, message: "사진을 읽지 못했습니다. 다른 파일로 시도해 주세요." };
  }

  // 열쇠에 무작위 값을 넣어 같은 자리에 다시 올려도 주소가 겹치지 않게 한다.
  const key = `battle/${spotId}/${randomUUID()}.webp`;
  try {
    await putObject(key, body, "image/webp");
  } catch {
    return { ok: false, message: "사진을 보관함에 올리지 못했습니다." };
  }

  const previous = await setSpotImage(spotId, key, "image/webp", isPublic);
  await dropObjects([previous]);

  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
  return { ok: true };
}

export async function clearSpotImageAction(baseId: string, spotId: string) {
  await requireAdmin();
  await dropObjects([await clearSpotImage(spotId)]);
  revalidatePath("/battle");
  revalidatePath(`/battle/${baseId}`);
}

/** 이미 올린 사진의 공개 여부만 바꾼다. 파일은 그대로 둔다. */
export async function setSpotImagePublicAction(
  baseId: string,
  spotId: string,
  isPublic: boolean,
) {
  await requireAdmin();
  await setSpotImagePublic(spotId, isPublic);
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
