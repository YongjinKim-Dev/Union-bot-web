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
  Else: "기타(아처, 샤이, 스칼라)",
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
  discord_message_id: string | null;
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
