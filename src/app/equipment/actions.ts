"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { apBasisFor, parseBuild } from "@/lib/equipment";
import { getUserCharacterClass } from "@/lib/queries";
import {
  deleteSpecBuild, getOpenSpecSurvey, saveSpecBuild, submitSpec,
  type SpecBuildStats, type SpecSubmissionRow,
} from "@/lib/specQueries";

/*
 * 투표와 같은 규칙을 따른다 — 예상되는 실패는 throw 하지 않고 반환값으로
 * 돌려준다. 프로덕션 빌드에서는 서버가 던진 메시지가 클라이언트까지 오지
 * 않고 "Minified React error #441" 로 바뀌어, 사용자는 왜 안 됐는지 알 수
 * 없는 영문 코드만 보게 된다.
 */
export type SaveBuildResponse =
  | { ok: true; id: string; name: string; stats: SpecBuildStats }
  | { ok: false; message: string };

export async function saveBuildAction(raw: unknown): Promise<SaveBuildResponse> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  }
  // 화면이 보낸 값도 저장값과 똑같이 의심한다. 검증은 parseBuild 한 군데다.
  let build;
  try {
    build = parseBuild(raw);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "세팅을 저장할 수 없습니다." };
  }
  /*
   * 어느 공격력을 볼지는 직업이 정하므로 서버가 직접 읽는다. 화면이 함께
   * 보내면 직업을 바꿔 놓고 옛 기준으로 저장할 수 있다.
   */
  const basis = apBasisFor(await getUserCharacterClass(session.user.dbUserId));
  const saved = await saveSpecBuild(session.user.dbUserId, build, basis);
  if (!saved.ok) return { ok: false, message: saved.message };
  return { ok: true, id: saved.id, name: build.name, stats: saved.stats };
}

export type DeleteBuildResponse = { ok: true } | { ok: false; message: string };

export async function deleteBuildAction(buildId: string): Promise<DeleteBuildResponse> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  }
  const removed = await deleteSpecBuild(session.user.dbUserId, buildId);
  if (!removed) return { ok: false, message: "이미 지워진 세팅입니다. 새로 고침하면 목록이 맞춰집니다." };
  return { ok: true };
}

export type SubmitSpecResponse =
  | { ok: true; surveyTitle: string; submission: SpecSubmissionRow }
  | { ok: false; message: string };

/*
 * 어느 조사에 내는지는 서버가 정한다. 화면이 회차를 함께 보내면, 오래 열어둔
 * 탭이 이미 닫힌 회차에 낼 수 있다.
 */
export async function submitSpecAction(buildId: string): Promise<SubmitSpecResponse> {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    return { ok: false, message: "로그인이 풀렸습니다. 새로 고침 후 다시 시도해 주세요." };
  }
  const survey = await getOpenSpecSurvey();
  if (!survey) {
    return { ok: false, message: "지금은 받고 있는 스펙조사가 없습니다." };
  }
  // 직업을 모르면 공방합을 낼 수 없다. 낼 수 없는 값을 명단에 올리지 않는다.
  const basis = apBasisFor(await getUserCharacterClass(session.user.dbUserId));
  if (!basis) {
    return { ok: false, message: "직업을 먼저 등록해 주세요. 공방합 기준이 직업에 따라 달라집니다." };
  }
  const result = await submitSpec(survey.id, session.user.dbUserId, buildId, basis);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/profile");
  return { ok: true, surveyTitle: survey.title, submission: result.submission };
}
