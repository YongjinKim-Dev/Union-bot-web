import catalog from "./equipmentCatalog.json";
import { CAPHRAS_SHEET_DATA } from "./equipmentCaphrasData";
import { AUGMENT_SLOTS, buildAugmentText, equipAugment } from "./equipmentAugments";
import type { ClassType } from "./types";
import type { AugmentKind, AugmentSelection } from "./equipmentAugments";

/*
 * 한 세팅은 장비·수정·광명석 셋을 함께 담는다. 장비만 바꾸고 수정이 그대로
 * 남으면 그것은 세팅이 아니다. 표기 공방 계산에는 장비만 쓴다 — 수정과
 * 광명석의 수치는 카탈로그에 없다.
 */
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
export interface EquipmentBuild {
  id: string;
  name: string;
  equipment: Partial<Record<EquipmentSlotId, EquippedItem>>;
  crystals: AugmentSelection;
  lightstones: AugmentSelection;
}
export interface EquipmentWorkspace { version: 1 | 2 | 3; activeId: string; builds: EquipmentBuild[] }
/** v2 까지는 수정·광명석이 세팅 밖에 있었다. 옛 저장값을 읽을 때만 쓴다. */
type LegacyBuild = Omit<EquipmentBuild, "crystals" | "lightstones"> & Partial<Pick<EquipmentBuild, "crystals" | "lightstones">>;
interface LegacyWorkspace { version: 1 | 2 | 3; activeId: string; builds: LegacyBuild[] }
/** 한 사람이 가질 수 있는 세팅 수. spec_build 는 "사용자당 몇 개" 를 제약으로 쓸 수 없어 여기서 막는다. */
export const MAX_BUILDS = 8;
/** spec_build.name 이 varchar(40) 이다. */
export const BUILD_NAME_MAX = 40;
/** 공식 가이드 wikiNo=308: 바탈리 6 + 10주년 1 + 잠식 1 + 카마/오딜 각 1 + 아침 1 + 레벨 1 + 행복한 흑정령 1. */
export const COMPLETED_PROGRESSION = { ap: 12, aap: 12, dp: 12 } as const;

/*
 * 공방합에 어느 공격력을 더할지는 직업이 정한다.
 *
 *   전승   주무기 공격력
 *   각성   각성무기 공격력
 *   기타   각성무기 공격력. 다만 데드아이·세라핌·샤이·오공은 주무기 공격력이다.
 *
 * 둘 중 큰 쪽을 쓰면 안 된다. 각성 직업이 주무기를 더 올려 두었다고 해서 그
 * 수치로 줄 세우면 실제로 쓰는 무기와 다른 것을 비교하게 된다.
 */
export type ApBasis = "main" | "awakening";
const MAIN_WEAPON_ELSE = ["데드아이", "세라핌", "샤이", "오공"];
export function apBasisFor(characterClass: { type: ClassType; name: string } | null): ApBasis | null {
  if (!characterClass) return null;
  if (characterClass.type === "Succession") return "main";
  if (characterClass.type === "Awaken") return "awakening";
  return MAIN_WEAPON_ELSE.includes(characterClass.name) ? "main" : "awakening";
}
export const AP_BASIS_LABEL: Record<ApBasis, string> = {
  main: "주무기 공격력",
  awakening: "각성무기 공격력",
};

export interface EquipmentSheetStats {
  ap: number;
  aap: number;
  dp: number;
  /** 기준이 없으면 뜻이 없는 값이다. basis 가 null 일 때는 보여주지 않는다. */
  score: number;
  complete: boolean;
  basis: ApBasis | null;
}
export function calculateEquipmentStats(build: EquipmentBuild, basis: ApBasis | null): EquipmentSheetStats {
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
  return { ap, aap, dp, score: basis === null ? 0 : (basis === "main" ? ap : aap) + dp, complete, basis };
}
export function emptyWorkspace(): EquipmentWorkspace { return { version: 3, activeId: "initial", builds: [{ id: "initial", name: "내 장비", equipment: {}, crystals: {}, lightstones: {} }] }; }
/** 사용자가 2026-09-07 화면에서 지정한 기본 구성. 매번 독립 객체로 시작한다. */
export function defaultEquipmentWorkspace(): EquipmentWorkspace {
  return { version: 3, activeId: "initial", builds: [{ id: "initial", crystals: {}, lightstones: {}, name: "내 장비", equipment: {
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
function migrateSol(build: LegacyBuild): LegacyBuild {
  const sol = build.equipment.awakening_weapon;
  if (!sol || sol.enhancement !== 0 || !["garmoth-748001", "garmoth-748002", "garmoth-748003"].includes(sol.itemId)) return build;
  return { ...build, equipment: { ...build.equipment, awakening_weapon: { ...sol, enhancement: 20 } } };
}
/** v2 까지는 수정·광명석이 세팅 밖에 있었다. 그때 저장한 세팅은 빈 구성으로 연다. */
export function migrateEquipmentWorkspace(workspace: LegacyWorkspace): EquipmentWorkspace {
  if (workspace.version === 3) return workspace as EquipmentWorkspace;
  return { ...workspace, version: 3, builds: workspace.builds.map(build => {
    const migrated = workspace.version === 1 ? migrateSol(build) : build;
    return { ...migrated, crystals: migrated.crystals ?? {}, lightstones: migrated.lightstones ?? {} };
  }) };
}
/*
 * 세팅을 하나로 접는다. 저장·제출이 붙기 전, 화면이 세팅 하나만 다루던 때에
 * 쓰던 것이다. 지금은 세팅을 여러 개 두므로 화면에서 부르지 않는다.
 */
export function singleEquipmentWorkspace(workspace: EquipmentWorkspace): EquipmentWorkspace {
  const current = migrateEquipmentWorkspace(workspace);
  const selected = current.builds.find(b => b.id === current.activeId) ?? current.builds[0];
  return { version: 3, activeId: selected.id, builds: [{ ...selected, name: "내 장비" }] };
}
export function canUseCaphras(item: EquipmentItem, enhancement: number): boolean { return Boolean(item.caphrasCategory && CAPHRAS_SHEET_DATA[enhancement]?.[item.caphrasCategory]); }
export function equipItem(build: EquipmentBuild, slotId: EquipmentSlotId, itemId: string): EquipmentBuild {
  const slot = EQUIPMENT_SLOTS.find(s => s.id === slotId), item = EQUIPMENT_BY_ID.get(itemId);
  if (!slot || !item || slot.category !== item.category) throw new Error("장비 부위가 맞지 않습니다.");
  if (build.equipment[slotId]?.itemId === itemId) return build;
  return { ...build, equipment: { ...build.equipment, [slotId]: { itemId, enhancement: item.defaultEnhancement ?? 0, caphras: 0 } } };
}
/*
 * 슬롯 하나씩 equipAugment 에 태워 확인한다. 그 함수가 이미 "이 슬롯에 낄 수
 * 있는 종류인가" 와 "계열 장착 한도를 넘지 않는가" 를 들고 있으므로, 검증
 * 규칙을 여기에 다시 쓰면 두 벌이 되어 어긋난다.
 */
function parseAugmentSelection(kind: AugmentKind, raw: unknown): AugmentSelection {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("수정·광명석 형식이 올바르지 않습니다.");
  const source = raw as Record<string, unknown>;
  let selection: AugmentSelection = {};
  for (const slot of AUGMENT_SLOTS[kind]) {
    const itemId = source[slot.id];
    if (itemId === undefined || itemId === null) continue;
    if (typeof itemId !== "string") throw new Error("수정·광명석 형식이 올바르지 않습니다.");
    selection = equipAugment(kind, selection, slot.id, itemId);
  }
  return selection;
}

/*
 * 세팅 하나를 확인한다. 브라우저 저장값도, 화면이 서버로 보낸 값도, DB 에서
 * 읽어온 값도 모두 이 함수를 지난다. 검증을 한 군데로 모아야 서버와 화면이
 * 서로 다른 것을 통과시키지 않는다.
 */
export function parseBuild(raw: unknown): EquipmentBuild {
  const b = raw as LegacyBuild;
  if (!b || typeof b.id !== "string" || !b.id || b.id.length > 80 || typeof b.name !== "string" || !b.name.trim() || b.name.length > BUILD_NAME_MAX || !b.equipment || typeof b.equipment !== "object" || Array.isArray(b.equipment)) throw new Error("장비 세팅 형식이 올바르지 않습니다.");
  const equipment: EquipmentBuild["equipment"] = {};
  for (const slot of EQUIPMENT_SLOTS) {
    if (!Object.hasOwn(b.equipment, slot.id)) continue;
    const selected = b.equipment[slot.id], item = selected && EQUIPMENT_BY_ID.get(selected.itemId);
    if (!selected || !item || item.category !== slot.category || !Number.isInteger(selected.enhancement) || selected.enhancement < 0 || selected.enhancement >= enhancementOptions(item.enhancementKind).length || !Number.isInteger(selected.caphras) || selected.caphras < 0 || selected.caphras > 20) throw new Error("장비 또는 강화 단계가 올바르지 않습니다.");
    equipment[slot.id] = { itemId: item.id, enhancement: selected.enhancement, caphras: canUseCaphras(item, selected.enhancement) ? selected.caphras : 0 };
  }
  return {
    id: b.id, name: b.name.trim(), equipment,
    crystals: parseAugmentSelection("crystal", b.crystals),
    lightstones: parseAugmentSelection("lightstone", b.lightstones),
  };
}

/** 브라우저 저장값도 신뢰하지 않는다. 버전·슬롯·장비·강화 범위를 확인한다. */
export function parseWorkspace(raw: string): EquipmentWorkspace {
  if (raw.length > 100_000) throw new Error("저장 데이터가 너무 큽니다.");
  const data = JSON.parse(raw);
  if (!data || ![1, 2, 3].includes(data.version) || !Array.isArray(data.builds) || !data.builds.length || data.builds.length > MAX_BUILDS) throw new Error("지원하지 않는 장비 데이터입니다.");
  const ids = new Set<string>();
  const builds: LegacyBuild[] = data.builds.map((b: LegacyBuild) => {
    const parsed = parseBuild(b);
    if (ids.has(parsed.id)) throw new Error("장비 세팅 형식이 올바르지 않습니다.");
    ids.add(parsed.id);
    return parsed;
  });
  return migrateEquipmentWorkspace({ version: data.version, activeId: ids.has(data.activeId) ? data.activeId : builds[0].id, builds });
}
export function buildEquipmentText(build: EquipmentBuild, basis: ApBasis | null): string {
  const stats = calculateEquipmentStats(build, basis);
  const summary = !stats.complete
    ? "표기 공방: 수치 미확인 장비 포함"
    : stats.basis === null
      ? `주무기 ${stats.ap} / 각성무기 ${stats.aap} / 방어력 ${stats.dp} · 공방합은 직업을 등록해야 나옵니다`
      : `주무기 ${stats.ap} / 각성무기 ${stats.aap} / 방어력 ${stats.dp} / 공방합 ${stats.score} (${AP_BASIS_LABEL[stats.basis]} 기준)`;
  const gear = [`[${build.name}]`, summary, "내실 전체 완료 · 레벨 60 이상 기준", ...EQUIPMENT_SLOTS.flatMap(slot => {
    const selected = build.equipment[slot.id], item = selected && EQUIPMENT_BY_ID.get(selected.itemId);
    if (!selected || !item) return [];
    return [`${slot.label}: ${equippedItemName(item, selected.enhancement)}${selected.caphras ? ` (카프라스 ${selected.caphras}단계)` : ""}`];
  })];
  // 세팅에 함께 담기므로 복사한 글에도 같이 나간다. 빈 것은 줄을 만들지 않는다.
  const augments = ([["crystal", build.crystals], ["lightstone", build.lightstones]] as const)
    .filter(([, selection]) => Object.keys(selection).length)
    .map(([kind, selection]) => `\n${buildAugmentText(kind, selection)}`);
  return [...gear, ...augments].join("\n");
}
