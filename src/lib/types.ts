export type VotingType = "attend" | "non_attend" | "boarding" | "late_attend";

export const ATTEND_TYPES: VotingType[] = ["attend", "boarding"];

export const VOTING_TYPE_LABEL: Record<VotingType, string> = {
  attend: "참여",
  non_attend: "미참",
  boarding: "부속",
  late_attend: "늦참",
};

export type ClassType = "Succession" | "Awaken" | "Else";

export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  Succession: "전승",
  Awaken: "각성",
  Else: "기타",
};

// Sub-label for the 계열 cards on the class-registration screen.
export const CLASS_TYPE_SUBLABEL: Record<ClassType, string> = {
  Succession: "주 무기 계열",
  Awaken: "각성 무기 계열",
  Else: "개방 · 재능 계열",
};

export interface DbUser {
  id: string;
  user_nickname: string;
  user_discord_id: string;
  guild_id: string;
  status: number;
  permission: string;
}

export interface DbSurvey {
  id: string;
  type: string;
  content: string;
  status: "wait" | "process" | "complete" | "cancel";
  // mysql2 converts DATETIME columns to JS Date instants using the pool's
  // `timezone: "+09:00"` setting, so these already compare correctly against
  // `new Date()` without any manual KST math.
  executed_at: Date;
  exposed_at: Date;
  /** 공지가 나가면 웹훅이 돌려준 메시지 id 가 들어간다. NULL 이면 아직 안 보냄. */
  discord_message_id: string | null;
  /** 공지를 보낼 시각. 등록 시 "N분 전"을 절대 시각으로 환산해 저장한다. */
  announce_at: Date | null;
  /** 공지 문구. 관리자가 설문마다 다르게 쓸 수 있다. */
  announce_content: string | null;
}

export interface DbSurveyHistory {
  id: string;
  voting_type: VotingType;
  survey_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbCharacterClass {
  id: string;
  name: string;
  type: ClassType;
}

export interface UserCharacterClass {
  type: ClassType;
  name: string;
}
