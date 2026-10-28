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

/*
 * 몇 초마다 부르는 자리. 번호를 돌려주면서 "나 여기 있다" 고 적어 둔다.
 *
 * 같이 보고 있는 사람 목록은 잠깐 살았다 사라지는 것이라 DB 에 두지 않는다.
 * 웹은 컨테이너 하나로 도니까 이 모듈의 변수 하나면 충분하고, 서버가 다시
 * 뜨면 비는 편이 오히려 맞다 — 그때는 아무도 안 보고 있는 것이 맞으므로.
 */
const VIEWER_TTL_MS = 12000;
const viewers = new Map<string, Map<string, { name: string; at: number }>>();

export interface BoardPulse {
  version: number;
  /** 나를 뺀, 지금 같은 판을 보고 있는 사람들. */
  viewers: string[];
}

export async function boardPulseAction(surveyId: string): Promise<BoardPulse> {
  const who = await admin();
  if (!who) return { version: 0, viewers: [] };
  const me = who.id ?? "?";
  const now = Date.now();
  let board = viewers.get(surveyId);
  if (!board) { board = new Map(); viewers.set(surveyId, board); }
  board.set(me, { name: who.nickname ?? "누군가", at: now });
  const here: string[] = [];
  for (const [id, seen] of board) {
    if (now - seen.at > VIEWER_TTL_MS) board.delete(id);
    else if (id !== me) here.push(seen.name);
  }
  return { version: await getSquadBoardVersion(surveyId), viewers: here };
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
