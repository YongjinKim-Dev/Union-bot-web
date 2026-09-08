"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { AUGMENT_BY_ID, type AugmentSelection } from "@/lib/equipmentAugments";
import {
  LIGHTSTONE_COMBINATIONS, activeLightstoneCombination, lightstoneCombinationIngredients,
  type LightstoneCombination,
} from "@/lib/equipmentLightstoneCombinations";
import styles from "./augments.module.css";

const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const searchableRecipes = LIGHTSTONE_COMBINATIONS.map(recipe => ({
  recipe,
  search: normalize(`${recipe.name} ${recipe.english} ${recipe.required.flat().map(id => AUGMENT_BY_ID.get(`lightstone-${id}`)?.name ?? "").join(" ")}`),
}));

function RecipeFormula({ recipe }: { recipe: LightstoneCombination }) {
  return <ul className={styles.formula} aria-label={`${recipe.name} 조합 재료`}>
    {lightstoneCombinationIngredients(recipe).map(({ alternatives, count }, index) => {
      const item = AUGMENT_BY_ID.get(`lightstone-${alternatives[0]}`)!;
      return <li key={index} title={alternatives.map(id => AUGMENT_BY_ID.get(`lightstone-${id}`)?.name).join(" 또는 ")}>
        <Image src={item.image} alt="" width={25} height={25} unoptimized />
        <span>{item.name}</span><b>×{count}</b>
      </li>;
    })}
  </ul>;
}

export function LightstoneCombinations({ selection }: { selection: AugmentSelection }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const active = activeLightstoneCombination(selection);
  const recipes = searchableRecipes.filter(entry => (mode === "all" || entry.recipe.mode === mode) && entry.search.includes(normalize(search)));

  return <div className={styles.combinations}>
    <div className={`${styles.currentCombination} ${active ? styles.combinationActive : ""}`} aria-live="polite" aria-atomic="true" data-active-combination={active?.id ?? "none"}>
      <span className={styles.combinationLabel}>현재 광명석 조합</span>
      <strong>{active?.name ?? "완성된 조합 없음"}</strong>
      {active ? <RecipeFormula recipe={active} /> : <p>광명석을 장착하면 조합식이 표시됩니다.</p>}
    </div>
    <button type="button" className={styles.recipeToggle} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}>
      <span>광명석 조합식 <b>{LIGHTSTONE_COMBINATIONS.length}</b></span><span>{open ? "접기 −" : "보기 +"}</span>
    </button>
    <div id={listId} hidden={!open}>
      {open && <>
        <div className={styles.recipeFilters}>
          <input type="search" aria-label="광명석 조합식 검색" placeholder="조합 이름 또는 재료 검색" value={search} onChange={event => setSearch(event.target.value)} />
          <select aria-label="광명석 조합식 분류" value={mode} onChange={event => setMode(event.target.value)}><option value="all">전체</option><option value="combat">전투</option><option value="lifeskill">생활</option></select>
        </div>
        <p className={styles.recipeNote}>일반·증폭 광명석 혼용 가능 · 검색 결과 {recipes.length}개</p>
        <div className={styles.recipeList} role="region" aria-label="광명석 조합식 목록" tabIndex={0}>
          {recipes.map(({ recipe }) => <article key={recipe.id} className={styles.recipe} data-lightstone-recipe={recipe.id}>
            <div className={styles.recipeHeading}><h3>{recipe.name}</h3><span>{active?.id === recipe.id ? "적용 중" : recipe.mode === "combat" ? "전투" : "생활"} · {recipe.required.length}개</span></div>
            <RecipeFormula recipe={recipe} />
          </article>)}
          {!recipes.length && <p className={styles.recipeEmpty}>검색한 조합식이 없습니다.</p>}
        </div>
      </>}
    </div>
  </div>;
}
