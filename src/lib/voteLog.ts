import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { VotingType } from "@/lib/types";

/*
 * 거절된 투표만 남기는 기록.
 *
 * 성공한 표는 survey_history 에 도착 시각까지 그대로 남으므로 따로 적을 것이 없다.
 * 알 수 없던 것은 실패한 요청이었다 — 마감 직전에 눌러 거절됐는지, 로그인이
 * 풀렸는지. 실패는 드물어서(한 회차에 몇 건) 기록해도 부담이 없다.
 */
export async function ensureVoteFailureTable(): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS vote_failure_log (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "survey_id bigint NULL, " +
      "user_id bigint NULL, " +
      "nickname varchar(64) NULL, " +
      "voting_type varchar(20) NOT NULL, " +
      "reason varchar(20) NOT NULL, " +
      "message varchar(255) NOT NULL, " +
      "platform varchar(20) NOT NULL, " +
      "is_mobile tinyint(1) NOT NULL, " +
      "user_agent varchar(255) NULL, " +
      "arrived_at datetime(6) NOT NULL, " +
      "elapsed_ms int NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_failure_survey (survey_id), " +
      "KEY idx_failure_arrived (arrived_at))",
  );
}

export interface Device {
  platform: string;
  isMobile: boolean;
}

/*
 * User-Agent 에서 기기와 운영체제만 뽑는다. 정확한 브라우저 판별이 목적이 아니라
 * "폰에서 눌렀나 PC 에서 눌렀나" 를 보려는 것이라 이 정도면 충분하다.
 * 순서가 중요하다 — 안드로이드 UA 에도 Linux 가 들어 있어서 먼저 걸러야 한다.
 */
export function parseDevice(ua: string | null): Device {
  if (!ua) return { platform: "알수없음", isMobile: false };
  if (/iPhone|iPod/i.test(ua)) return { platform: "iOS", isMobile: true };
  if (/iPad/i.test(ua)) return { platform: "iPadOS", isMobile: true };
  if (/Android/i.test(ua)) return { platform: "Android", isMobile: /Mobile/i.test(ua) };
  if (/Windows/i.test(ua)) return { platform: "Windows", isMobile: false };
  if (/Mac OS X/i.test(ua)) return { platform: "macOS", isMobile: false };
  if (/Linux/i.test(ua)) return { platform: "Linux", isMobile: false };
  return { platform: "기타", isMobile: /Mobi/i.test(ua) };
}

export interface VoteFailure {
  surveyId: string | null;
  userId: string | null;
  nickname: string | null;
  votingType: VotingType;
  reason: string;
  message: string;
  userAgent: string | null;
  arrivedAt: Date;
  elapsedMs: number;
}

/* 기록이 실패해도 투표 처리에는 영향을 주지 않는다. 조용히 넘어간다. */
export async function logVoteFailure(f: VoteFailure): Promise<void> {
  const device = parseDevice(f.userAgent);
  try {
    await pool.execute(
      "INSERT INTO vote_failure_log " +
        "(survey_id, user_id, nickname, voting_type, reason, message, platform, is_mobile, user_agent, arrived_at, elapsed_ms) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        f.surveyId,
        f.userId,
        f.nickname,
        f.votingType,
        f.reason,
        f.message.slice(0, 255),
        device.platform,
        device.isMobile ? 1 : 0,
        f.userAgent?.slice(0, 255) ?? null,
        f.arrivedAt,
        f.elapsedMs,
      ],
    );
  } catch {
    // 로그를 못 남기는 것이 투표를 막아서는 안 된다.
  }
}

export interface VoteFailureRow {
  id: string;
  surveyId: string | null;
  nickname: string | null;
  votingType: VotingType;
  reason: string;
  message: string;
  platform: string;
  isMobile: boolean;
  arrivedAt: Date;
  elapsedMs: number;
}

export async function getVoteFailures(
  limit = 100,
): Promise<{ rows: VoteFailureRow[]; total: number }> {
  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM vote_failure_log",
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, survey_id, nickname, voting_type, reason, message, platform, is_mobile, arrived_at, elapsed_ms " +
      `FROM vote_failure_log ORDER BY arrived_at DESC, id DESC LIMIT ${Number(limit)}`,
  );
  return {
    total: Number(countRows[0].c),
    rows: rows.map((r) => ({
      id: String(r.id),
      surveyId: r.survey_id === null ? null : String(r.survey_id),
      nickname: (r.nickname as string) ?? null,
      votingType: r.voting_type as VotingType,
      reason: r.reason as string,
      message: r.message as string,
      platform: r.platform as string,
      isMobile: Number(r.is_mobile) === 1,
      arrivedAt: r.arrived_at as Date,
      elapsedMs: Number(r.elapsed_ms),
    })),
  };
}
