import type { RowDataPacket } from "mysql2";
import { buildDefaultAnnounceContent } from "@/lib/announce";
import { pool } from "@/lib/db";
import { formatSurveyDate, formatSurveyTime } from "@/lib/format";
import { createSurvey } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { kstDateKey, kstDatePlus, kstInstant } from "@/lib/week";

/* 자동 등록이 미리 채워 두는 구간. 관리자 화면의 예정 큐가 보여주는 길이와 같다. */
const QUEUE_AHEAD_DAYS = 14;

/*
 * 앞으로 2주 동안 회차 있는지 보고 → 없으면 만듦
 * 이미 해당 날짜에 큐가 존재 → 건너뜀
 * 함수 도는 시점: 서버 시작할 때, 매일 자정, 자동 등록 규칙 저장 직후.
 */
export async function syncSurveyQueue(now: Date = new Date()): Promise<number> {
  const { autoRule } = await getSettings();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT executed_at FROM survey WHERE executed_at >= ?",
    [now],
  );
  const taken = new Set(rows.map((r) => kstDateKey(r.executed_at as Date)));

  let created = 0;
  for (let i = 0; i <= QUEUE_AHEAD_DAYS; i += 1) {
    const day = kstDatePlus(now, i);
    if (!autoRule.weekdays.includes(day.weekday)) continue;

    const executedAt = kstInstant(day.year, day.month, day.day, autoRule.battleTime);
    if (executedAt <= now) continue;
    if (taken.has(kstDateKey(executedAt))) continue;

    // 자동 등록된 거점전의 투표는 전날에 열린다
    const exposedAt = kstInstant(day.year, day.month, day.day - 1, autoRule.openTime);
    const announceAt =
      autoRule.announceMinutes > 0
        ? new Date(exposedAt.getTime() - autoRule.announceMinutes * 60 * 1000)
        : null;
    const announceContent = announceAt
      ? autoRule.announceText.trim() || buildDefaultAnnounceContent(executedAt, exposedAt)
      : null;
    const content = `${formatSurveyDate(executedAt)} ${formatSurveyTime(executedAt)} 거점전 설문조사`;

    await createSurvey({ content, executedAt, exposedAt, announceAt, announceContent, type: "node_war_auto" });
    created += 1;
  }
  return created;
}

/*
 * 자동 등록 규칙을 저장한 직후 부른다.
 * 아직 투표가 안 열린 자동 생성 회차를 전부 지우고 새 규칙대로 다시 채운다.
 * 수동 등록 회차와 이미 열린 투표는 건드리지 않는다.
 */
export async function rebuildAutoQueue(now: Date = new Date()): Promise<void> {
  await pool.execute(
    "DELETE FROM survey WHERE type = 'node_war_auto' AND status <> 'cancel' AND exposed_at > ?",
    [now],
  );
  await syncSurveyQueue(now);
}
