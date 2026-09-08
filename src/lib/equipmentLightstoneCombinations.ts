import catalog from "./equipmentLightstoneCombinations.json";
import { AUGMENT_BY_ID, AUGMENT_SLOTS, type AugmentSelection } from "./equipmentAugments";

export interface LightstoneCombination {
  id: string;
  name: string;
  english: string;
  mode: "combat" | "lifeskill";
  /** 각 칸은 광명석 1개를 요구하며, 내부 ID들은 일반·증폭 등 대체 가능한 재료다. */
  required: readonly (readonly number[])[];
}
export const LIGHTSTONE_COMBINATIONS = catalog as readonly LightstoneCombination[];

export function matchesLightstoneCombination(recipe: LightstoneCombination, equipped: readonly number[]): boolean {
  function match(index: number, remaining: readonly number[]): boolean {
    if (index === recipe.required.length) return true;
    return remaining.some((id, slot) => recipe.required[index].includes(id)
      && match(index + 1, remaining.filter((_, i) => i !== slot)));
  }
  // 같은 재료가 두 번 필요하면 실제 장착 개수도 두 개여야 한다.
  return match(0, equipped);
}

export function activeLightstoneCombination(selection: AugmentSelection): LightstoneCombination | null {
  const equipped = AUGMENT_SLOTS.lightstone.flatMap(slot => {
    const item = AUGMENT_BY_ID.get(selection[slot.id]);
    return item?.kind === "lightstone" ? [item.sourceId] : [];
  });
  let active: LightstoneCombination | null = null;
  for (const recipe of LIGHTSTONE_COMBINATIONS) {
    // 원본과 같이 4개 조합이 3개 조합보다 우선하며, 같은 길이는 원본 순서를 따른다.
    if ((!active || recipe.required.length > active.required.length) && matchesLightstoneCombination(recipe, equipped)) active = recipe;
  }
  return active;
}

export function lightstoneCombinationIngredients(recipe: LightstoneCombination) {
  const ingredients = new Map<string, { alternatives: readonly number[]; count: number }>();
  for (const alternatives of recipe.required) {
    const key = [...alternatives].sort((a, b) => a - b).join(",");
    const ingredient = ingredients.get(key);
    if (ingredient) ingredient.count += 1;
    else ingredients.set(key, { alternatives, count: 1 });
  }
  return [...ingredients.values()];
}
