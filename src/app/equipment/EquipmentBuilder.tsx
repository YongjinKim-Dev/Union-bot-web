"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  EQUIPMENT_SLOTS, EQUIPMENT_ITEMS, EQUIPMENT_BY_ID, BUILD_NAME_MAX, MAX_BUILDS,
  defaultEquipmentWorkspace, migrateEquipmentWorkspace, equipItem, enhancementOptions, enhancementLabel, canUseCaphras, buildEquipmentText, calculateEquipmentStats,
  type ApBasis, type EquipmentBuild, type EquipmentSlotId, type EquipmentWorkspace,
} from "@/lib/equipment";
import { formatKstDateTime } from "@/lib/format";
import type { SpecSubmissionRow } from "@/lib/specQueries";
import styles from "./equipment.module.css";
import { AugmentBoard, AugmentEditor, useAugmentEditor, type EquipmentMode } from "./AugmentPanels";
import { GearBoard, SpecModeButtons, SpecSheet } from "./SpecBoards";
import { LightstoneCombinations } from "./LightstoneCombinations";
import { deleteBuildAction, saveBuildAction, submitSpecAction } from "./actions";

/** 이름과 장착만 견준다. id 는 저장하면서 바뀌므로 달라진 것으로 치지 않는다. */
function snapshot(build: EquipmentBuild): string {
  return JSON.stringify([build.name, build.equipment, build.crystals, build.lightstones]);
}
function nextBuildName(builds: EquipmentBuild[]): string {
  const taken = new Set(builds.map(build => build.name));
  for (let n = 1; n <= MAX_BUILDS + 1; n += 1) {
    const name = n === 1 ? "새 세팅" : `새 세팅 ${n}`;
    if (!taken.has(name)) return name;
  }
  return `새 세팅 ${Date.now().toString(36)}`;
}
function blankBuild(id: string, name: string): EquipmentBuild {
  return { id, name, equipment: {}, crystals: {}, lightstones: {} };
}

interface Props {
  savedBuilds: EquipmentBuild[];
  brokenBuilds: number;
  surveyTitle: string | null;
  submission: SpecSubmissionRow | null;
  /** 등록한 직업이 정하는 공방합 기준. 직업이 없으면 비어 있다. */
  basis: ApBasis | null;
  className: string | null;
}

export function EquipmentBuilder({ savedBuilds, brokenBuilds, surveyTitle, submission: submitted, basis, className }: Props) {
  const boardRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<EquipmentMode>("gear");
  // 저장해 둔 것이 있으면 그것으로 연다. 처음 온 사람에게만 예시 세팅을 보여준다.
  const [storedWorkspace, setWorkspace] = useState<EquipmentWorkspace>(() =>
    savedBuilds.length ? { version: 3, activeId: savedBuilds[0].id, builds: savedBuilds } : defaultEquipmentWorkspace());
  // 저장된 순간의 모습. 지금 세팅과 다르면 아직 저장하지 않은 것이다.
  const [savedShape, setSavedShape] = useState<Record<string, string>>(() =>
    Object.fromEntries(savedBuilds.map(build => [build.id, snapshot(build)])));
  const [submission, setSubmission] = useState(submitted);
  const [busy, setBusy] = useState<"save" | "delete" | "submit" | null>(null);
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
  const stats = calculateEquipmentStats(build, basis);
  const query = search.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
  const items = EQUIPMENT_ITEMS.filter(i => i.category === slot.category && `${i.name}${i.english}${i.aliases.join(" ")}`.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "").includes(query));
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  if (sort === "rarity") items.sort((a, b) => b.rarity - a.rarity);

  function edit(fn: (build: EquipmentBuild) => EquipmentBuild) {
    setWorkspace(stored => {
      const current = migrateEquipmentWorkspace(stored);
      return { ...current, builds: current.builds.map(b => b.id === current.activeId ? fn(b) : b) };
    });
    setNotice(null);
  }

  /* ── 세팅 보관 ── */

  const isStored = (id: string) => /^\d+$/.test(id);
  const isDirty = (b: EquipmentBuild) => savedShape[b.id] !== snapshot(b);
  const dirty = isDirty(build);
  const nameReady = build.name.trim().length > 0;

  function selectBuild(id: string) {
    setWorkspace(w => ({ ...w, activeId: id }));
    setNotice(null);
  }
  function addBuild() {
    if (workspace.builds.length >= MAX_BUILDS) {
      setNotice({ error: true, text: `세팅은 최대 ${MAX_BUILDS}개까지 만들 수 있어요. 쓰지 않는 세팅을 지워 주세요.` });
      return;
    }
    const id = `new-${Date.now().toString(36)}`;
    setWorkspace(w => ({ ...w, activeId: id, builds: [...w.builds, blankBuild(id, nextBuildName(w.builds))] }));
    setNotice(null);
  }
  function dropBuild(id: string) {
    setWorkspace(w => {
      const rest = w.builds.filter(b => b.id !== id);
      if (!rest.length) {
        const fresh = blankBuild(`new-${Date.now().toString(36)}`, "새 세팅");
        return { ...w, activeId: fresh.id, builds: [fresh] };
      }
      return { ...w, activeId: rest[0].id, builds: rest };
    });
  }

  async function save() {
    setBusy("save");
    const result = await saveBuildAction(build);
    setBusy(null);
    if (!result.ok) { setNotice({ error: true, text: result.message }); return null; }
    // 새로 만든 세팅은 여기서 처음 DB 의 id 를 받는다.
    setWorkspace(w => ({ ...w, activeId: result.id, builds: w.builds.map(b => b.id === build.id ? { ...b, id: result.id } : b) }));
    setSavedShape(prev => ({ ...prev, [result.id]: snapshot(build) }));
    return result.id;
  }
  async function saveOnly() {
    const id = await save();
    if (id) setNotice({ text: `"${build.name.trim()}" 세팅을 저장했어요.` });
  }
  async function remove() {
    const target = build;
    // 저장한 적 없는 세팅은 서버에 물어볼 것이 없다.
    if (!isStored(target.id)) { dropBuild(target.id); setNotice(null); return; }
    setBusy("delete");
    const result = await deleteBuildAction(target.id);
    setBusy(null);
    if (!result.ok) { setNotice({ error: true, text: result.message }); return; }
    dropBuild(target.id);
    if (submission?.sourceBuildId === target.id) setSubmission({ ...submission, sourceBuildId: null });
    setNotice({ text: `"${target.name}" 세팅을 지웠어요. 이미 낸 스펙은 그대로 남아 있어요.` });
  }
  /*
   * 서버는 저장된 줄만 읽어서 낸다. 그래서 고친 것이 있으면 먼저 저장한다.
   * 그러지 않으면 화면에 보이는 세팅과 실제로 낸 세팅이 달라진다.
   */
  async function submit() {
    const id = dirty || !isStored(build.id) ? await save() : build.id;
    if (!id) return;
    setBusy("submit");
    const result = await submitSpecAction(id);
    setBusy(null);
    if (!result.ok) { setNotice({ error: true, text: result.message }); return; }
    setSubmission(result.submission);
    setNotice({ text: `${result.surveyTitle}에 "${result.submission.buildName}" 세팅을 냈어요. 공방합 ${result.submission.score}.` });
  }
  function scrollToPanel(panel: HTMLElement | null) {
    panel?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  function chooseSlot(next: EquipmentSlotId) {
    setSlotId(next); setSearch(""); setNotice(null);
    if (window.matchMedia("(max-width: 760px)").matches) scrollToPanel(editorRef.current);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(buildEquipmentText(build, basis)); setNotice({ text: "현재 장비 목록을 복사했어요." }); }
    catch { setNotice({ error: true, text: "복사 권한을 확인해 주세요. 장비 세팅은 그대로 유지됩니다." }); }
  }
  function changeEnhancement(value: number) {
    if (!item || !selected) return;
    edit(b => ({ ...b, equipment: { ...b.equipment, [slotId]: { ...selected, enhancement: value, caphras: canUseCaphras(item, value) ? selected.caphras : 0 } } }));
  }
  function removeItem() {
    edit(b => { const equipment = { ...b.equipment }; delete equipment[slotId]; return { ...b, equipment }; });
  }

  return (
    <div className={styles.content}>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>SPEC SURVEY</p><h1>스펙조사</h1></div>
        <div className={styles.headingSide}>
          {basis && className && <p className={styles.basisNote}>{className} · 공방합은 {basis === "main" ? "주무기" : "각성무기"} 공격력 + DP</p>}
          {submission
            ? <p className={styles.submitted}><strong>제출함</strong> · {submission.buildName} · 공방합 {submission.isComplete ? submission.score : "—"} · {formatKstDateTime(submission.updatedAt)}</p>
            : <p className={styles.submitted} data-empty="true">아직 낸 스펙이 없어요{surveyTitle ? ` · ${surveyTitle} 접수 중` : ""}</p>}
        </div>
      </div>

      <div className={styles.buildBar}>
        <div className={styles.buildTabs} role="group" aria-label="내 세팅">
          {workspace.builds.map(b => (
            <button key={b.id} type="button" data-build={b.id}
              aria-pressed={b.id === workspace.activeId}
              className={`${styles.buildTab} ${b.id === workspace.activeId ? styles.buildActive : ""}`}
              onClick={() => selectBuild(b.id)}>
              <span>{b.name.trim() || "이름 없는 세팅"}</span>
              {isDirty(b) && <span className={styles.buildDot} title="저장하지 않은 변경이 있어요" aria-label="저장 안 됨">●</span>}
              {submission?.sourceBuildId === b.id && <span className={styles.buildSent}>제출</span>}
            </button>
          ))}
          <button type="button" className={styles.buildAdd} onClick={addBuild}
            disabled={workspace.builds.length >= MAX_BUILDS} title={`최대 ${MAX_BUILDS}개`}>+ 새 세팅</button>
        </div>
        <div className={styles.buildActions}>
          <label className={styles.buildName}>
            <span className={styles.sectionLabel}>NAME</span>
            <input value={build.name} maxLength={BUILD_NAME_MAX} aria-label="세팅 이름"
              placeholder="세팅 이름" onChange={e => edit(b => ({ ...b, name: e.target.value }))} />
          </label>
          <button type="button" className={styles.button} disabled={busy !== null || !nameReady || !dirty} onClick={saveOnly}>
            {busy === "save" ? "저장 중…" : dirty ? "저장" : "저장됨"}
          </button>
          <button type="button" className={styles.button} disabled={busy !== null} onClick={remove}>
            {busy === "delete" ? "지우는 중…" : "삭제"}
          </button>
          <button type="button" className={styles.submitButton} disabled={busy !== null || !nameReady || !surveyTitle || !basis}
            title={!basis ? "직업을 먼저 등록해 주세요" : surveyTitle ? `${surveyTitle}에 이 세팅을 냅니다` : "지금은 받고 있는 스펙조사가 없어요"}
            onClick={submit}>
            {busy === "submit" ? "제출 중…" : "스펙조사 제출"}
          </button>
        </div>
      </div>

      {!basis && <p role="status" className={`${styles.notice} ${styles.error}`}>직업을 먼저 등록해 주세요. 공방합을 주무기로 볼지 각성무기로 볼지가 직업에 따라 달라서, 등록 전에는 공방합이 나오지 않고 제출도 할 수 없어요. <Link href="/classes">직업 등록하러 가기</Link></p>}
      {brokenBuilds > 0 && <p role="status" className={`${styles.notice} ${styles.error}`}>장비 목록이 바뀌어 열지 못한 세팅이 {brokenBuilds}개 있어요. 새로 만들어 주세요.</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={`${styles.notice} ${notice.error ? styles.error : ""}`}>{notice.text}</p>}

      <div className={styles.workspace} data-equipment-mode={mode}>
        <section ref={boardRef} className={styles.boardPanel} aria-label={`내 ${modeTitle} 슬롯`}>
          <div className={styles.panelHeading}><span className={styles.sectionLabel}>{mode === "gear" ? "MY EQUIPMENT" : mode === "crystal" ? "MY CRYSTALS" : "MY LIGHTSTONES"}</span><span className={styles.counter}>{mode === "gear" ? count : augment.count}<span> / {mode === "gear" ? EQUIPMENT_SLOTS.length : augment.slots.length}</span></span></div>
          <div className={styles.nameRow}><h2>{build.name.trim() || "이름 없는 세팅"} · {modeTitle}</h2></div>
          {mode === "gear"
            ? <GearBoard build={build} activeSlotId={slotId} onSelect={chooseSlot} />
            : <AugmentBoard kind={augment.kind} selection={augment.selection} activeSlotId={augment.slotId}
                onSelect={id => { augment.chooseSlot(id); if (window.matchMedia("(max-width: 760px)").matches) scrollToPanel(editorRef.current); }} />}
          {mode === "lightstone" && <LightstoneCombinations selection={lightstones.selection} />}
          <SpecModeButtons mode={mode} onChange={setMode} />
          <SpecSheet stats={stats} />
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
          <div className={styles.summaryFooter}><div><p className={styles.sectionLabel}>MY EQUIPMENT</p><strong>{build.name.trim() || "이름 없는 세팅"}</strong><span> · {count}개 장착</span></div><button type="button" className={styles.button} disabled={!count} onClick={copyText}>장비 목록 복사</button></div>
          </>}
        </section>
      </div>
      <footer className={styles.pageFooter}><a href="https://garmoth.com/character/default" target="_blank" rel="noreferrer">참고: Garmoth Gear Planner ↗</a></footer>
    </div>
  );
}
