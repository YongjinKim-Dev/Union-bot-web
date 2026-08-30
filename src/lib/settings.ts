import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";

/* 관리자 설정. settings 테이블에 이름-값(JSON 문자열)으로 담는다. */

export interface AutoRule {
  /** 거점전을 여는 요일. 0=일 … 6=토 (week.ts와 같은 관례) */
  weekdays: number[];
  /** 거점전 시각 "21:00" */
  battleTime: string;
  /** 투표 오픈 시각 "22:30". 거점전 전날에 열린다 */
  openTime: string;
  /** 투표 오픈 몇 분 전에 디코 공지를 보낼지. 0이면 보내지 않는다 */
  announceMinutes: number;
  /** 공지 문구. 비우면 기본 문구를 만들어 쓴다 */
  announceText: string;
}

export interface AdminSettings {
  autoRule: AutoRule;
  capPresets: number[];
}

export const DEFAULT_SETTINGS: AdminSettings = {
  autoRule: {
    weekdays: [1, 2, 3, 4, 5, 0],
    battleTime: "21:00",
    openTime: "22:30",
    announceMinutes: 15,
    announceText: "",
  },
  capPresets: [55, 75, 100],
};

/* 서버가 켜질 때 한 번 부른다. 테이블이 없으면 만들고 기본값을 채운다. */
export async function ensureSettings(now: Date = new Date()): Promise<void> {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS settings (" +
      "name VARCHAR(64) NOT NULL PRIMARY KEY, " +
      "value TEXT NOT NULL, " +
      "updated_at DATETIME NULL" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );
  await pool.execute(
    "INSERT IGNORE INTO settings (name, value, updated_at) VALUES (?, ?, ?), (?, ?, ?)",
    [
      "auto_rule",
      JSON.stringify(DEFAULT_SETTINGS.autoRule),
      now,
      "cap_presets",
      JSON.stringify(DEFAULT_SETTINGS.capPresets),
      now,
    ],
  );
}

export async function getSettings(): Promise<AdminSettings> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT name, value FROM settings WHERE name IN ('auto_rule', 'cap_presets')",
  );
  const found = new Map(rows.map((r) => [r.name as string, r.value as string]));
  const autoRule = found.get("auto_rule");
  const capPresets = found.get("cap_presets");
  return {
    // 저장된 값에 없는 필드는 기본값으로 채운다. 설정 항목이 늘어도 옛 저장본이 그대로 동작한다.
    autoRule: { ...DEFAULT_SETTINGS.autoRule, ...(autoRule ? (JSON.parse(autoRule) as Partial<AutoRule>) : {}) },
    capPresets: capPresets ? (JSON.parse(capPresets) as number[]) : DEFAULT_SETTINGS.capPresets,
  };
}

async function saveSetting(name: string, value: unknown, now: Date) {
  await pool.execute(
    "INSERT INTO settings (name, value, updated_at) VALUES (?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)",
    [name, JSON.stringify(value), now],
  );
}

export async function saveAutoRule(rule: AutoRule, now: Date = new Date()): Promise<void> {
  await saveSetting("auto_rule", rule, now);
}

export async function saveCapPresets(presets: number[], now: Date = new Date()): Promise<void> {
  await saveSetting("cap_presets", presets, now);
}
