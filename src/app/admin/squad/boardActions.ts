"use server";

import { auth } from "@/auth";
import {
  getSquadBoard, getSquadBoardVersion, saveSquadBoard, type SaveResult,
} from "@/lib/squadBoardQueries";

/** 편성을 고치는 것은 운영진만 한다. 화면이 가려져 있는 것과 별개로 여기서 막는다. */
async function admin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return { id: session.user.dbUserId ?? null, nickname: session.user.nickname ?? null };
}

export interface BoardSnapshot {
  data: string;
  version: number;
  updatedBy: string | null;
  /** 밀리초. Date 를 그대로 넘기지 않는다. */
  updatedAt: number;
}

export async function loadBoardAction(surveyId: string): Promise<BoardSnapshot | null> {
  if (!(await admin())) return null;
  const board = await getSquadBoard(surveyId);
  if (!board) return null;
  return {
    data: board.data, version: board.version,
    updatedBy: board.updatedBy, updatedAt: board.updatedAt.getTime(),
  };
}

/** 몇 초마다 부르는 자리. 번호만 돌려준다. */
export async function boardVersionAction(surveyId: string): Promise<number> {
  if (!(await admin())) return 0;
  return getSquadBoardVersion(surveyId);
}

export type SaveBoardResult =
  | { ok: true; version: number }
  | { ok: false; board: BoardSnapshot | null };

export async function saveBoardAction(
  surveyId: string, data: string, baseVersion: number,
): Promise<SaveBoardResult> {
  const who = await admin();
  if (!who) return { ok: false, board: null };
  const result: SaveResult = await saveSquadBoard(surveyId, data, baseVersion, who.nickname);
  if (result.ok) return result;
  return {
    ok: false,
    board: result.board && {
      data: result.board.data, version: result.board.version,
      updatedBy: result.board.updatedBy, updatedAt: result.board.updatedAt.getTime(),
    },
  };
}
