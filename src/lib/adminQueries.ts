import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";
import { getVotingClosesAt } from "@/lib/format";
import type { DbSurvey } from "@/lib/types";

/* 관리자 화면 전용 조회 */

/*
 * 오늘 투표 회차와 그 뒤 예정 큐.
 * 투표 페이지와 달리 거점전 시각이 지날 때까지 회차를 물고 있는다.
 * 마감 뒤 순번 조정과 발표를 여기서 해야 하기 때문이다.
 * 단, 다음 회차 투표가 열리면 앞 회차 거점전 전이라도 그쪽으로 넘어간다.
 */
export async function getScheduleOverview(
  now: Date = new Date(),
): Promise<{ current: DbSurvey | null; queue: DbSurvey[] }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, type, content, status, executed_at, exposed_at, announce_at, announce_content, discord_message_id " +
      "FROM survey WHERE status <> 'cancel' AND executed_at > ? ORDER BY executed_at ASC",
    [now],
  );
  const list = rows as DbSurvey[];
  // 앞 회차가 마감된 상태에서 다음 회차 투표가 열렸을 때만 넘어간다.
  // 라이브 중인 회차는 다음 투표가 열려도 자리를 지킨다.
  let idx = 0;
  for (let i = 1; i < list.length; i += 1) {
    const prev = list[idx];
    const prevClosed = prev.status === "complete" || now >= getVotingClosesAt(prev.executed_at);
    if (prevClosed && list[i].exposed_at <= now) idx = i;
  }
  return { current: list[idx] ?? null, queue: list.slice(idx + 1) };
}
