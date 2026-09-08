import catalog from "./equipmentCatalog.json";
import { CAPHRAS_SHEET_DATA } from "./equipmentCaphrasData";

/** 장비 구성과 표기 공방 계산 전용. 상세 스탯 및 조사/DB 연동은 하지 않는다. */
export type EquipmentCategory = "main_weapon" | "sub_weapon" | "awakening_weapon" | "helmet" | "armor" | "gloves" | "shoes" | "necklace" | "belt" | "ring" | "earring" | "alchemy_stone" | "book" | "artifact";
export type EnhancementKind = "standard" | "standard-ten" | "standard-four" | "three" | "five" | "ten" | "ancient" | "numeric-five" | "reformed" | "none";
export type EquipmentSlotId = EquipmentCategory | "ring2" | "earring2" | "artifact2";
export interface EquipmentSlot { id: EquipmentSlotId; category: EquipmentCategory; label: string; x: number; y: number }
// 가모스 부위 순서는 유지하되 바깥 15칸을 24도 간격으로 배치한다. 고서/연금석은 별도 위치다.
function ringPosition(index: number) {
  const angle = (index * 24 - 102) * Math.PI / 180;
  // 서버와 브라우저의 삼각함수 끝자리 차이가 style hydration 오류를 만들지 않도록 고정한다.
  return { x: Number((50 + 42 * Math.cos(angle)).toFixed(4)), y: Number((48 + 42 * Math.sin(angle)).toFixed(4)) };
}
export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  { id: "helmet", category: "helmet", label: "투구", ...ringPosition(0) },
  { id: "earring", category: "earring", label: "귀걸이 1", ...ringPosition(14) },
  { id: "earring2", category: "earring", label: "귀걸이 2", ...ringPosition(13) },
  { id: "armor", category: "armor", label: "갑옷", ...ringPosition(1) },
  { id: "gloves", category: "gloves", label: "장갑", ...ringPosition(5) },
  { id: "shoes", category: "shoes", label: "신발", ...ringPosition(11) },
  { id: "ring", category: "ring", label: "반지 1", ...ringPosition(2) },
  { id: "ring2", category: "ring", label: "반지 2", ...ringPosition(3) },
  { id: "alchemy_stone", category: "alchemy_stone", label: "연금석", x: 50, y: 44.512 },
  { id: "necklace", category: "necklace", label: "목걸이", ...ringPosition(6) },
  { id: "belt", category: "belt", label: "허리띠", ...ringPosition(10) },
  { id: "main_weapon", category: "main_weapon", label: "주무기", ...ringPosition(9) },
  { id: "awakening_weapon", category: "awakening_weapon", label: "각성무기", ...ringPosition(8) },
  { id: "sub_weapon", category: "sub_weapon", label: "보조무기", ...ringPosition(7) },
  { id: "artifact", category: "artifact", label: "유물 1", ...ringPosition(12) },
  { id: "book", category: "book", label: "모험가의 고서", x: 6.312, y: 91.341 },
  { id: "artifact2", category: "artifact", label: "유물 2", ...ringPosition(4) },
];

export interface EquipmentItem {
  id: string; category: EquipmentCategory; name: string; english: string;
  rarity: number; enhancementKind: EnhancementKind; sourceImage: string;
  caphras?: boolean; caphrasCategory?: string;
  defaultEnhancement?: number;
  aliases: string[]; sourceIds: number[]; sourceType: number;
  ap: number[]; dp: number[];
}
/** 원본의 같은 공통 무기 계열만 합친다. sourceIds로 모든 원본 항목을 추적한다. */
export const EQUIPMENT_ITEMS = catalog as EquipmentItem[];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT_ITEMS.map(item => [item.id, item]));
const roman = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export function enhancementOptions(kind: EnhancementKind): string[] {
  if (kind === "none") return ["0"];
  if (kind === "numeric-five" || kind === "reformed") return Array.from({ length: 6 }, (_, i) => String(i));
  if (kind === "standard" || kind === "standard-ten" || kind === "standard-four") return [...Array.from({ length: 16 }, (_, i) => String(i)), ...roman.slice(1, kind === "standard-ten" ? 11 : kind === "standard-four" ? 5 : 6)];
  if (kind === "three") return roman.slice(0, 4);
  return roman.slice(0, kind === "ten" ? 11 : 6);
}
const koreanEnhancements = ["", "장", "광", "고", "유", "동", "운", "우", "풍", "단", "환"];
const ancientEnhancements = ["", "갈망하는", "일그러진", "침묵하는", "울부짖는", "멸겁하는"];
export function enhancementLabel(item: EquipmentItem, enhancement: number): string {
  const level = enhancementOptions(item.enhancementKind)[enhancement];
  if (item.enhancementKind === "reformed") return enhancement === 0 ? "유(IV) · 개량 전" : enhancement === 5 ? "동(V) · 개량 완료" : `유(IV) · 개량 ${enhancement}단계`;
  if (level === "0") return "미강화";
  const rank = roman.indexOf(level);
  if (rank < 0) return `+${level}`;
  return item.enhancementKind === "ancient" ? ancientEnhancements[rank] : `${koreanEnhancements[rank]}(${level})`;
}
export function equippedItemName(item: EquipmentItem, enhancement: number): string {
  return `${enhancement ? enhancementLabel(item, enhancement) + " " : ""}${item.name}`;
}
export interface EquippedItem { itemId: string; enhancement: number; caphras: number }
export interface EquipmentBuild { id: string; name: string; equipment: Partial<Record<EquipmentSlotId, EquippedItem>> }
export interface EquipmentWorkspace { version: 1 | 2; activeId: string; builds: EquipmentBuild[] }
// 기존 구성 형식 검증용 상한. 현재 화면에는 저장/불러오기 기능이 없다.
const LEGACY_MAX_BUILDS = 8;
/** 공식 가이드 wikiNo=308: 바탈리 6 + 10주년 1 + 잠식 1 + 카마/오딜 각 1 + 아침 1 + 레벨 1 + 행복한 흑정령 1. */
export const COMPLETED_PROGRESSION = { ap: 12, aap: 12, dp: 12 } as const;
export interface EquipmentSheetStats { ap: number; aap: number; dp: number; score: number; complete: boolean }
export function calculateEquipmentStats(build: EquipmentBuild): EquipmentSheetStats {
  let ap: number = COMPLETED_PROGRESSION.ap, aap: number = COMPLETED_PROGRESSION.aap, dp: number = COMPLETED_PROGRESSION.dp;
  let complete = true;
  for (const slot of EQUIPMENT_SLOTS) {
    const selected = build.equipment[slot.id];
    if (!selected) continue;
    const item = EQUIPMENT_BY_ID.get(selected.itemId);
    if (!item || item.category !== slot.category || !Number.isInteger(selected.enhancement) || selected.enhancement < 0 || selected.enhancement >= enhancementOptions(item.enhancementKind).length || !Number.isInteger(selected.caphras) || selected.caphras < 0 || selected.caphras > 20) { complete = false; continue; }
    let itemAp = item.ap[selected.enhancement];
    let itemDp = item.dp[selected.enhancement];
    if (!Number.isFinite(itemAp) || !Number.isFinite(itemDp)) { complete = false; continue; }
    if (selected.caphras && canUseCaphras(item, selected.enhancement)) {
      const group = item.caphrasCategory!;
      const bonus = CAPHRAS_SHEET_DATA[selected.enhancement]?.[group]?.[selected.caphras];
      if (!bonus) { complete = false; continue; }
      itemAp += bonus[0]; itemDp += bonus[1];
    }
    if (slot.category !== "awakening_weapon") ap += itemAp;
    if (slot.category !== "main_weapon") aap += itemAp;
    dp += itemDp;
  }
  // 개별 아이템의 0.5를 먼저 버리면 표기 공격력이 달라진다. 합친 뒤 한 번만 버린다.
  ap = Math.floor(ap); aap = Math.floor(aap);
  return { ap, aap, dp, score: Math.max(ap, aap) + dp, complete };
}
export function emptyWorkspace(): EquipmentWorkspace { return { version: 2, activeId: "initial", builds: [{ id: "initial", name: "내 장비", equipment: {} }] }; }
/** 사용자가 2026-09-07 화면에서 지정한 기본 구성. 매번 독립 객체로 시작한다. */
export function defaultEquipmentWorkspace(): EquipmentWorkspace {
  return { version: 2, activeId: "initial", builds: [{ id: "initial", name: "내 장비", equipment: {
    helmet: { itemId: "garmoth-930601", enhancement: 8, caphras: 0 },
    armor: { itemId: "garmoth-930602", enhancement: 8, caphras: 0 },
    gloves: { itemId: "garmoth-930603", enhancement: 8, caphras: 0 },
    shoes: { itemId: "garmoth-930604", enhancement: 8, caphras: 0 },
    earring: { itemId: "garmoth-11897", enhancement: 5, caphras: 0 },
    earring2: { itemId: "garmoth-11897", enhancement: 5, caphras: 0 },
    ring: { itemId: "garmoth-12143", enhancement: 5, caphras: 0 },
    ring2: { itemId: "garmoth-12143", enhancement: 5, caphras: 0 },
    necklace: { itemId: "garmoth-11732", enhancement: 5, caphras: 0 },
    belt: { itemId: "garmoth-12297", enhancement: 5, caphras: 0 },
    main_weapon: { itemId: "garmoth-930701", enhancement: 10, caphras: 0 },
    awakening_weapon: { itemId: "garmoth-747601", enhancement: 10, caphras: 0 },
    sub_weapon: { itemId: "garmoth-930401", enhancement: 10, caphras: 0 },
    alchemy_stone: { itemId: "garmoth-761841", enhancement: 0, caphras: 0 },
    artifact: { itemId: "garmoth-930612", enhancement: 0, caphras: 0 },
    artifact2: { itemId: "garmoth-930612", enhancement: 0, caphras: 0 },
    book: { itemId: "garmoth-12817", enhancement: 0, caphras: 0 },
  } }] };
}
/** v1의 태초 솔 index 0은 미강화가 아니라 동(V) 수치였으므로 기존 구성을 보존한다. */
export function migrateEquipmentWorkspace(workspace: EquipmentWorkspace): EquipmentWorkspace {
  if (workspace.version === 2) return workspace;
  return { ...workspace, version: 2, builds: workspace.builds.map(build => {
    const sol = build.equipment.awakening_weapon;
    if (!sol || sol.enhancement !== 0 || !["garmoth-748001", "garmoth-748002", "garmoth-748003"].includes(sol.itemId)) return build;
    return { ...build, equipment: { ...build.equipment, awakening_weapon: { ...sol, enhancement: 20 } } };
  }) };
}
export function singleEquipmentWorkspace(workspace: EquipmentWorkspace): EquipmentWorkspace {
  const current = migrateEquipmentWorkspace(workspace);
  const selected = current.builds.find(b => b.id === current.activeId) ?? current.builds[0];
  return { version: 2, activeId: selected.id, builds: [{ ...selected, name: "내 장비" }] };
}
export function canUseCaphras(item: EquipmentItem, enhancement: number): boolean { return Boolean(item.caphrasCategory && CAPHRAS_SHEET_DATA[enhancement]?.[item.caphrasCategory]); }
export function equipItem(build: EquipmentBuild, slotId: EquipmentSlotId, itemId: string): EquipmentBuild {
  const slot = EQUIPMENT_SLOTS.find(s => s.id === slotId), item = EQUIPMENT_BY_ID.get(itemId);
  if (!slot || !item || slot.category !== item.category) throw new Error("장비 부위가 맞지 않습니다.");
  if (build.equipment[slotId]?.itemId === itemId) return build;
  return { ...build, equipment: { ...build.equipment, [slotId]: { itemId, enhancement: item.defaultEnhancement ?? 0, caphras: 0 } } };
}
/** 브라우저 저장값도 신뢰하지 않는다. 버전·슬롯·장비·강화 범위를 확인한다. */
export function parseWorkspace(raw: string): EquipmentWorkspace {
  if (raw.length > 100_000) throw new Error("저장 데이터가 너무 큽니다.");
  const data = JSON.parse(raw);
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.builds) || !data.builds.length || data.builds.length > LEGACY_MAX_BUILDS) throw new Error("지원하지 않는 장비 데이터입니다.");
  const ids = new Set<string>();
  const builds: EquipmentBuild[] = data.builds.map((b: EquipmentBuild) => {
    if (!b || typeof b.id !== "string" || !b.id || b.id.length > 80 || ids.has(b.id) || typeof b.name !== "string" || !b.name.trim() || b.name.length > 40 || !b.equipment || typeof b.equipment !== "object" || Array.isArray(b.equipment)) throw new Error("장비 세팅 형식이 올바르지 않습니다.");
    ids.add(b.id);
    const equipment: EquipmentBuild["equipment"] = {};
    for (const slot of EQUIPMENT_SLOTS) {
      if (!Object.hasOwn(b.equipment, slot.id)) continue;
      const selected = b.equipment[slot.id], item = selected && EQUIPMENT_BY_ID.get(selected.itemId);
      if (!selected || !item || item.category !== slot.category || !Number.isInteger(selected.enhancement) || selected.enhancement < 0 || selected.enhancement >= enhancementOptions(item.enhancementKind).length || !Number.isInteger(selected.caphras) || selected.caphras < 0 || selected.caphras > 20) throw new Error("장비 또는 강화 단계가 올바르지 않습니다.");
      equipment[slot.id] = { itemId: item.id, enhancement: selected.enhancement, caphras: canUseCaphras(item, selected.enhancement) ? selected.caphras : 0 };
    }
    return { id: b.id, name: b.name.trim(), equipment };
  });
  return migrateEquipmentWorkspace({ version: data.version, activeId: ids.has(data.activeId) ? data.activeId : builds[0].id, builds });
}
export function buildEquipmentText(build: EquipmentBuild): string {
  const stats = calculateEquipmentStats(build);
  return [`[${build.name}]`, stats.complete ? `AP ${stats.ap} / AAP ${stats.aap} / DP ${stats.dp} / 공방합 ${stats.score}` : "표기 공방: 수치 미확인 장비 포함", "내실 전체 완료 · 레벨 60 이상 기준", ...EQUIPMENT_SLOTS.flatMap(slot => {
    const selected = build.equipment[slot.id], item = selected && EQUIPMENT_BY_ID.get(selected.itemId);
    if (!selected || !item) return [];
    return [`${slot.label}: ${equippedItemName(item, selected.enhancement)}${selected.caphras ? ` (카프라스 ${selected.caphras}단계)` : ""}`];
  })].join("\n");
}
