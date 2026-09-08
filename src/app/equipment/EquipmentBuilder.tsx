"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  EQUIPMENT_SLOTS, EQUIPMENT_ITEMS, EQUIPMENT_BY_ID,
  defaultEquipmentWorkspace, singleEquipmentWorkspace, migrateEquipmentWorkspace, equipItem, enhancementOptions, enhancementLabel, equippedItemName, canUseCaphras, buildEquipmentText, calculateEquipmentStats,
  type EquipmentBuild, type EquipmentSlot, type EquipmentSlotId,
} from "@/lib/equipment";
import styles from "./equipment.module.css";
import { AugmentBoard, AugmentEditor, EquipmentModeIcon, useAugmentEditor, type EquipmentMode } from "./AugmentPanels";
import { LightstoneCombinations } from "./LightstoneCombinations";

export function EquipmentBuilder() {
  const boardRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<EquipmentMode>("gear");
  const [storedWorkspace, setWorkspace] = useState(defaultEquipmentWorkspace);
  const [slotId, setSlotId] = useState<EquipmentSlotId>("helmet");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const workspace = migrateEquipmentWorkspace(storedWorkspace);
  const build = workspace.builds.find(b => b.id === workspace.activeId)!;
  // 수정·광명석도 세팅의 일부다. 편집기가 따로 들고 있지 않고 세팅에서 읽고 쓴다.
  const crystals = useAugmentEditor("crystal", build.crystals, next => edit(b => ({ ...b, crystals: next })));
  const lightstones = useAugmentEditor("lightstone", build.lightstones, next => edit(b => ({ ...b, lightstones: next })));
  const augment = mode === "lightstone" ? lightstones : crystals;
  const modeTitle = mode === "gear" ? "장비" : augment.title;
  const slot = EQUIPMENT_SLOTS.find(s => s.id === slotId)!;
  const selected = build.equipment[slotId];
  const item = selected && EQUIPMENT_BY_ID.get(selected.itemId);
  const count = Object.keys(build.equipment).length;
  const stats = calculateEquipmentStats(build);
  const query = search.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
  const items = EQUIPMENT_ITEMS.filter(i => i.category === slot.category && `${i.name}${i.english}${i.aliases.join(" ")}`.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").includes(query));
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  if (sort === "rarity") items.sort((a, b) => b.rarity - a.rarity);

  function edit(fn: (build: EquipmentBuild) => EquipmentBuild) {
    setWorkspace(stored => {
      const current = migrateEquipmentWorkspace(stored);
      return singleEquipmentWorkspace({ ...current, builds: current.builds.map(b => b.id === current.activeId ? fn(b) : b) });
    });
    setNotice(null);
  }
  function scrollToPanel(panel: HTMLElement | null) {
    panel?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  function chooseSlot(next: EquipmentSlotId) {
    setSlotId(next); setSearch(""); setNotice(null);
    if (window.matchMedia("(max-width: 760px)").matches) scrollToPanel(editorRef.current);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(buildEquipmentText({ ...build, name: "내 장비" })); setNotice({ text: "현재 장비 목록을 복사했어요." }); }
    catch { setNotice({ error: true, text: "복사 권한을 확인해 주세요. 장비 세팅은 그대로 유지됩니다." }); }
  }
  function changeEnhancement(value: number) {
    if (!item || !selected) return;
    edit(b => ({ ...b, equipment: { ...b.equipment, [slotId]: { ...selected, enhancement: value, caphras: canUseCaphras(item, value) ? selected.caphras : 0 } } }));
  }
  function removeItem() {
    edit(b => { const equipment = { ...b.equipment }; delete equipment[slotId]; return { ...b, equipment }; });
  }
  function slotButton(s: EquipmentSlot) {
    const selection = build.equipment[s.id];
    const equipped = selection && EQUIPMENT_BY_ID.get(selection.itemId);
    const level = equipped && selection ? enhancementOptions(equipped.enhancementKind)[selection.enhancement] : "0";
    return (
      <button key={s.id} type="button" data-slot={s.id}
        className={`${styles.slot} ${s.id === slotId ? styles.slotActive : ""} ${equipped ? styles.slotEquipped : ""}`}
        style={{ left: `${s.x}%`, top: `${s.y}%` }}
        aria-pressed={s.id === slotId} aria-label={`${s.label}: ${equipped && selection ? equippedItemName(equipped, selection.enhancement) : "미장착"}`}
        title={equipped?.name ?? s.label} onClick={() => chooseSlot(s.id)}>
        <span className={styles.slotIcon} data-rarity={equipped?.rarity}>
          <Image src={equipped ? `/gear/items/${equipped.id}.webp` : `/gear/slots/${s.category}.png`} alt="" width={48} height={48} unoptimized />
          {level !== "0" && <span className={styles.slotLevel}>{level}</span>}
          {selection && selection.caphras > 0 && <span className={styles.slotCaphras}>C{selection.caphras}</span>}
        </span>
        <span className={styles.slotLabel}>{s.label}</span>
      </button>
    );
  }

  return (
    <div className={styles.content}>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>SPEC SURVEY</p><h1>스펙조사</h1></div>
      </div>
      {mode === "gear" && notice && <p role={notice.error ? "alert" : "status"} className={`${styles.notice} ${notice.error ? styles.error : ""}`}>{notice.text}</p>}

      <div className={styles.workspace} data-equipment-mode={mode}>
        <section ref={boardRef} className={styles.boardPanel} aria-label={`내 ${modeTitle} 슬롯`}>
          <div className={styles.panelHeading}><span className={styles.sectionLabel}>{mode === "gear" ? "MY EQUIPMENT" : mode === "crystal" ? "MY CRYSTALS" : "MY LIGHTSTONES"}</span><span className={styles.counter}>{mode === "gear" ? count : augment.count}<span> / {mode === "gear" ? EQUIPMENT_SLOTS.length : augment.slots.length}</span></span></div>
          <div className={styles.nameRow}><h2>내 {modeTitle}</h2></div>
          {mode === "gear" ? <div className={styles.gearBoard}>
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.boardMark} aria-hidden="true"><svg viewBox="0 0 100 124" fill="none"><path d="M50 5 91 23v36c0 28-23 49-41 61C32 108 9 87 9 59V23L50 5Z" stroke="currentColor" strokeWidth="1.5" /><path d="m50 24 22 42-22 33-22-33 22-42Z" stroke="currentColor" /><path d="M50 24v75M28 66h44" stroke="currentColor" /></svg></div>
            {EQUIPMENT_SLOTS.map(s => slotButton(s))}
          </div> : <AugmentBoard editor={augment} onSelectSlot={() => { if (window.matchMedia("(max-width: 760px)").matches) scrollToPanel(editorRef.current); }} />}
          {mode === "lightstone" && <LightstoneCombinations selection={lightstones.selection} />}
          <div className={styles.modeButtons} role="group" aria-label="장착 화면 전환">
            {([['gear', '장비'], ['crystal', '수정'], ['lightstone', '광명석']] as const).map(([value, label]) => <button key={value} type="button" data-equipment-mode-button={value} aria-pressed={mode === value} className={mode === value ? styles.modeActive : ""} title={`${label} 장착 화면`} onClick={() => setMode(value)}><EquipmentModeIcon mode={value} /><span>{label}</span></button>)}
          </div>
          <div className={styles.sheetHeading}><span>표기 공격력 · 방어력</span><span>내실 전체 완료</span></div>
          <dl className={styles.sheetStats} aria-label="현재 세팅 표기 공방" aria-live="polite" aria-atomic="true">
            {([['ap', 'AP', '주무기 공격력'], ['aap', 'AAP', '각성 공격력'], ['dp', 'DP', '방어력'], ['score', 'SCORE', '공방합']] as const).map(([key, label, description]) => <div key={key} className={key === 'score' ? styles.scoreStat : undefined}><dt><abbr title={description}>{label}</abbr></dt><dd data-stat={key}>{stats.complete ? stats[key] : '—'}</dd></div>)}
          </dl>
          <p className={styles.sheetNote}>{stats.complete ? '공방합 = AP·AAP 중 높은 값 + DP' : '수치를 확인하지 못한 장비가 있어 합계를 표시하지 않습니다.'}<br />레벨 60 이상 · 일지·영구 보상 완료 (AP·AAP·DP 각 +12)</p>
        </section>

        <section ref={editorRef} className={styles.editorPanel} aria-label={`${modeTitle} 선택`}>
          {mode !== "gear" ? <AugmentEditor editor={augment} onReturnToSlots={() => scrollToPanel(boardRef.current)} /> : <>
          <button type="button" className={styles.mobileBack} onClick={() => scrollToPanel(boardRef.current)}>↑ 장비 슬롯으로</button>
          <div className={styles.filters}>
            <div className={styles.selectorTitle}><Image src={`/gear/slots/${slot.category}.png`} alt="" width={28} height={28} unoptimized /><h2>{slot.label}</h2></div>
            <label className={styles.search}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" aria-label="장비 검색" placeholder="장비 이름 검색" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <select aria-label="장비 정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="recommended">기본순</option><option value="rarity">등급순</option><option value="name">이름순</option></select>
          </div>
          <div className={styles.resultsLabel}><span>{search ? "검색 결과" : "전체 장비"} <strong>{items.length}</strong></span><div>{search && <button type="button" className={styles.textButton} onClick={() => setSearch("")}>검색 초기화</button>}{selected && <button type="button" className={styles.removeButton} onClick={removeItem}>장착 해제</button>}</div></div>
          <div key={`${slotId}:${search}:${sort}`} className={styles.itemGrid} role="group" aria-label={`${slot.label} 장비 목록`}>
            {items.map(i => <button type="button" key={i.id} className={`${styles.itemCard} ${i.id === item?.id ? styles.itemSelected : ""}`} aria-pressed={i.id === item?.id} onClick={() => edit(b => equipItem(b, slotId, i.id))}>
              <span className={styles.itemIcon} data-rarity={i.rarity}><Image src={`/gear/items/${i.id}.webp`} alt="" width={44} height={44} unoptimized /></span>
              <span className={styles.itemText}><span className={styles.itemName}>{i.name}</span><span className={styles.itemHint}>{i.enhancementKind === "none" ? "강화 없음" : `최대 ${enhancementLabel(i, enhancementOptions(i.enhancementKind).length - 1)}`}</span></span>
              <span className={styles.check} aria-hidden="true">{i.id === item?.id ? "✓" : "+"}</span>
            </button>)}
          </div>
          {!items.length && <div className={styles.noResults}><p>검색한 장비가 없습니다.</p><button type="button" className={styles.button} onClick={() => setSearch("")}>검색 초기화</button></div>}
          <p className={styles.catalogNote}>가모스 원본 · 2026.09.07 · 장착 부위 전체 {EQUIPMENT_ITEMS.length.toLocaleString()}개 선택지<br />무기는 공통 계열명입니다. 일반·개량·결합·등급별 변형과 수치가 다른 계열은 구분합니다.</p>

          {item && selected && item.enhancementKind !== "none" && <div className={styles.adjustments}>
              <fieldset className={styles.enhancement}><legend>강화 단계 <span>{enhancementLabel(item, selected.enhancement)}</span></legend><div className={styles.levels} data-kind={item.enhancementKind}>{enhancementOptions(item.enhancementKind).map((_, value) => <button type="button" key={value} aria-label={`강화 ${enhancementLabel(item, value)}`} aria-pressed={selected.enhancement === value} className={selected.enhancement === value ? styles.levelActive : ""} onClick={() => changeEnhancement(value)}>{enhancementLabel(item, value)}</button>)}</div></fieldset>
              {item.caphras && <div className={styles.caphras}><label htmlFor="equipment-caphras">카프라스 돌파 <span>고(III) 이상 · 최대 20단계</span></label><input id="equipment-caphras" type="number" min={0} max={20} step={1} disabled={!canUseCaphras(item, selected.enhancement)} value={selected.caphras} onChange={e => { const caphras = Math.max(0, Math.min(20, Math.trunc(Number(e.target.value) || 0))); edit(b => ({ ...b, equipment: { ...b.equipment, [slotId]: { ...selected, caphras } } })); }} /></div>}
          </div>}
          <div className={styles.summaryFooter}><div><p className={styles.sectionLabel}>MY EQUIPMENT</p><strong>내 장비</strong><span> · {count}개 장착</span></div><button type="button" className={styles.button} disabled={!count} onClick={copyText}>장비 목록 복사</button></div>
          </>}
        </section>
      </div>
      <footer className={styles.pageFooter}><a href="https://garmoth.com/character/default" target="_blank" rel="noreferrer">참고: Garmoth Gear Planner ↗</a></footer>
    </div>
  );
}
