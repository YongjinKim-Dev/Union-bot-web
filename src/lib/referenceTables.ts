/**
 * Static reference tables shown in the home page's 참고 자료 modals.
 *
 * Transcribed from the game-info images the guild supplied (see the design
 * handoff README). The rows follow fixed arithmetic patterns, so they are
 * generated rather than pasted — a typo in 56 hand-written rows would be
 * invisible. Verify against the latest in-game values before relying on them.
 */

// ── 공방합 구간 정보 ──────────────────────────────────────────

export interface AttackRow {
  /** 표기 공격력 */
  ap: number;
  /** 보너스 공격력 */
  bonus: number;
  /** 몬스터 추가 공격력 */
  monster: number;
}

const AP_MIN = 395;
const AP_MAX = 450;

export function buildAttackRows(): AttackRow[] {
  const rows: AttackRow[] = [];
  for (let i = 0; i <= AP_MAX - AP_MIN; i += 1) {
    // 242 for the first two rows, then +2 every second row: 245,245,247,247…
    const bonus = i < 2 ? 242 : 245 + (Math.floor(i / 2) - 1) * 2;
    // +8 per row through the first six, then +16 per row from 744.
    const monster = i < 6 ? 688 + i * 8 : 744 + (i - 6) * 16;
    rows.push({ ap: AP_MIN + i, bonus, monster });
  }
  return rows;
}

export interface DefenseRow {
  /** 표기 방어력 */
  dp: number;
  /** 보너스 피해 감소 */
  reduction: number;
}

const DP_MIN = 481;
const DP_MAX = 531;

export function buildDefenseRows(): DefenseRow[] {
  const rows: DefenseRow[] = [];
  for (let dp = DP_MIN; dp <= DP_MAX; dp += 1) {
    rows.push({ dp, reduction: 91 + Math.min(10, Math.floor((dp - DP_MIN) / 5)) });
  }
  return rows;
}

// ── 에크레타 악세사리 ─────────────────────────────────────────

export const ENHANCE_STAGES = [
  "노강",
  "장(I)",
  "광(II)",
  "고(III)",
  "유(IV)",
  "동(V)",
  "운(VI)",
  "우(VII)",
  "풍(VIII)",
  "단(IX)",
  "환(X)",
] as const;

/** 피해감소 · 회피력은 4부위 공통. 괄호 안은 히튼 적용 수치. */
const SHARED_DAMAGE_REDUCTION = [
  "0(1)", "0(2)", "1(2)", "1(3)", "1(4)", "1(5)", "2(5)", "2(6)", "2(7)", "2(8)", "3(8)",
];
const SHARED_EVASION = [
  "1(0)", "1(0)", "1(1)", "1(2)", "2(2)", "2(2)", "2(3)", "2(4)", "2(5)", "3(5)", "3(6)",
];

const RING_LIKE_ATTACK = [25, 26, 26, 27, 27, 28, 28, 29, 30, 31, 32];
const RING_LIKE_ACCURACY = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26];

export interface AccessoryRow {
  stage: string;
  attack: number;
  accuracy: number;
  damageReduction: string;
  evasion: string;
}

export interface AccessoryTable {
  title: string;
  rows: AccessoryRow[];
}

function buildAccessoryTable(
  title: string,
  attack: number[],
  accuracy: number[],
): AccessoryTable {
  return {
    title,
    rows: ENHANCE_STAGES.map((stage, i) => ({
      stage,
      attack: attack[i],
      accuracy: accuracy[i],
      damageReduction: SHARED_DAMAGE_REDUCTION[i],
      evasion: SHARED_EVASION[i],
    })),
  };
}

export const ACCESSORY_TABLES: AccessoryTable[] = [
  buildAccessoryTable("반지", RING_LIKE_ATTACK, RING_LIKE_ACCURACY),
  buildAccessoryTable(
    "귀걸이",
    [21, 22, 22, 23, 23, 24, 24, 25, 26, 27, 28],
    RING_LIKE_ACCURACY,
  ),
  buildAccessoryTable(
    "목걸이",
    [43, 44, 44, 45, 45, 46, 46, 47, 48, 49, 50],
    [29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 41],
  ),
  buildAccessoryTable("허리띠", RING_LIKE_ATTACK, RING_LIKE_ACCURACY),
];

export interface EnhanceRateRow {
  stage: string;
  baseRate: string;
  stack: number;
  appliedRate: string;
  agris: number;
  cron: number;
}

/** 적용 확률은 기준 스택을 채웠을 때의 값. 노강 단계는 시도 대상이 아니라 제외. */
export const ENHANCE_RATE_ROWS: EnhanceRateRow[] = [
  { stage: "장", baseRate: "1.8300%", stack: 140, appliedRate: "27.4500%", agris: 7, cron: 0 },
  { stage: "광", baseRate: "1.5700%", stack: 155, appliedRate: "25.9050%", agris: 7, cron: 290 },
  { stage: "고", baseRate: "1.3300%", stack: 175, appliedRate: "24.6050%", agris: 8, cron: 590 },
  { stage: "유", baseRate: "1.1100%", stack: 195, appliedRate: "22.7550%", agris: 9, cron: 960 },
  { stage: "동", baseRate: "0.9100%", stack: 205, appliedRate: "19.5650%", agris: 10, cron: 1150 },
  { stage: "운", baseRate: "0.7300%", stack: 220, appliedRate: "16.7900%", agris: 12, cron: 1420 },
  { stage: "우", baseRate: "0.5800%", stack: 230, appliedRate: "13.9200%", agris: 14, cron: 1590 },
  { stage: "풍", baseRate: "0.4400%", stack: 265, appliedRate: "12.1000%", agris: 16, cron: 1780 },
  { stage: "단", baseRate: "0.3100%", stack: 305, appliedRate: "9.7650%", agris: 20, cron: 2790 },
  { stage: "환", baseRate: "0.2000%", stack: 310, appliedRate: "6.4000%", agris: 30, cron: 3130 },
];

export function formatThousands(n: number): string {
  return n.toLocaleString("en-US");
}
