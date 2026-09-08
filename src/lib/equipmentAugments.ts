import catalog from "./equipmentAugmentCatalog.json";

/** 장착 구성 전용. 장비의 표기 공방 계산이나 DB에는 연결하지 않는다. */
export type AugmentKind = "crystal" | "lightstone";
export type AugmentSlotType = "general" | "ancient-spirit" | "kharazad" | "lightstone";
export interface AugmentItem {
  id: string;
  sourceId: number;
  kind: AugmentKind;
  name: string;
  english: string;
  group: string;
  family: string;
  rarity: number;
  limit: number | null;
  sorting: number;
  image: string;
  sourceImage: string;
}
export interface AugmentSlot { id: string; label: string; type: AugmentSlotType; section: string }
export type AugmentSelection = Readonly<Record<string, string>>;
export const AUGMENT_ITEMS = catalog as AugmentItem[];
export const AUGMENT_BY_ID = new Map(AUGMENT_ITEMS.map(item => [item.id, item]));
const generalSlotIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17];
export const AUGMENT_SLOTS: Record<AugmentKind, AugmentSlot[]> = {
  crystal: [
    ...generalSlotIds.map((id, index): AugmentSlot => ({ id: `crystal-${id}`, label: `수정 ${String(index + 1).padStart(2, "0")}`, type: "general", section: "일반 수정" })),
    { id: "crystal-15", label: "고대 정령", type: "ancient-spirit", section: "고대 정령의 수정" },
    ...[30, 31, 32, 33, 34, 35].map((id, index): AugmentSlot => ({ id: `crystal-${id}`, label: `새벽 ${index + 1}`, type: "kharazad", section: "새벽의 수정" })),
  ],
  lightstone: Array.from({ length: 4 }, (_, index) => ({ id: `lightstone-${index + 1}`, label: `광명석 ${index % 2 + 1}`, type: "lightstone", section: `유물 ${Math.floor(index / 2) + 1}` })),
};

const GROUP_LABELS: Record<string, string> = {
  unlimited: "제한 없음", "dim-magic": "은은한 마력", "damage-reduction": "피해 감소",
  "recovery-on-hit": "공격 시 회복", "increased-extra-damage": "추가 피해",
  "special-attack-evasion": "특수 공격 회피율", "max-energy": "최대 기운", breath: "잠수 시간",
  "ignore-all-resist": "모든 저항 무시", "resist-ii": "저항 II", jump: "점프력", descent: "낙하 피해 감소",
  "ultimate-gervish": "극 게르비슈", "ultimate-macalod": "극 마칼로드", "ultimate-hoom": "극 훔",
  bitterness: "혹한", decimation: "척살", destruction: "파괴", kharazad: "새벽", ahkrad: "아크라드",
  edania: "에다니아", resist: "저항", evasion: "회피력", spirit: "정령", viper: "살무사",
  hystria: "히스트리아", carmae: "카르메", "rbf-ii": "붉은 전장 II", "rbf-i": "붉은 전장 I",
  "ancient-spirit": "고대 정령", addis: "아디스", gervish: "게르비슈", macalod: "마칼로드",
  hoom: "훔", "red-fang-valor": "검붉은 용장", olucas: "올루카스", primodial: "태초",
};
export function augmentGroupLabel(item: AugmentItem): string {
  return item.kind === "lightstone" ? `${item.family} 광명석` : GROUP_LABELS[item.group] ?? item.group;
}
export function fitsAugmentSlot(item: AugmentItem, slot: AugmentSlot): boolean {
  if (slot.type === "lightstone") return item.kind === "lightstone";
  if (item.kind !== "crystal") return false;
  if (slot.type === "general") return !["ancient-spirit", "kharazad"].includes(item.group);
  return item.group === slot.type;
}
export function augmentUnavailableReason(kind: AugmentKind, selection: AugmentSelection, slotId: string, itemId: string): string | null {
  const slot = AUGMENT_SLOTS[kind].find(entry => entry.id === slotId);
  const item = AUGMENT_BY_ID.get(itemId);
  if (!slot || !item || !fitsAugmentSlot(item, slot)) return "이 슬롯에 장착할 수 없는 항목입니다.";
  if (kind === "crystal" && item.limit !== null) {
    // 교체 중인 슬롯은 세지 않아, 한도를 채운 상태에서도 같은 계열로 교체할 수 있다.
    const count = AUGMENT_SLOTS[kind].filter(entry => entry.id !== slotId && AUGMENT_BY_ID.get(selection[entry.id])?.group === item.group).length;
    if (count >= item.limit) return `${augmentGroupLabel(item)} 계열은 최대 ${item.limit}개까지 장착할 수 있습니다.`;
  }
  return null;
}
export function equipAugment(kind: AugmentKind, selection: AugmentSelection, slotId: string, itemId: string): AugmentSelection {
  const reason = augmentUnavailableReason(kind, selection, slotId, itemId);
  if (reason) throw new Error(reason);
  if (selection[slotId] === itemId) return selection;
  return { ...selection, [slotId]: itemId };
}
export function removeAugment(kind: AugmentKind, selection: AugmentSelection, slotId: string): AugmentSelection {
  if (!AUGMENT_SLOTS[kind].some(slot => slot.id === slotId)) throw new Error("올바르지 않은 슬롯입니다.");
  const next = { ...selection };
  delete next[slotId];
  return next;
}
export function buildAugmentText(kind: AugmentKind, selection: AugmentSelection): string {
  const lines = AUGMENT_SLOTS[kind].flatMap(slot => {
    const item = AUGMENT_BY_ID.get(selection[slot.id]);
    return item && fitsAugmentSlot(item, slot) ? [`${slot.section} · ${slot.label}: ${item.name}`] : [];
  });
  return [`[${kind === "crystal" ? "수정" : "광명석"} ${lines.length}개]`, ...lines].join("\n");
}
