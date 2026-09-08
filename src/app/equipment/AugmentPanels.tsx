"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import {
  AUGMENT_ITEMS, AUGMENT_BY_ID, AUGMENT_SLOTS, augmentGroupLabel,
  augmentUnavailableReason, fitsAugmentSlot, equipAugment, removeAugment, buildAugmentText,
  type AugmentKind, type AugmentSelection, type AugmentSlot,
} from "@/lib/equipmentAugments";
import ui from "./equipment.module.css";
import styles from "./augments.module.css";

export type EquipmentMode = "gear" | AugmentKind;
export function EquipmentModeIcon({ mode }: { mode: EquipmentMode }) {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    {mode === "gear" ? <><path d="m16 3 11 5v8c0 7-6 11-11 13C11 27 5 23 5 16V8l11-5Z" /><path d="m16 9 5 7-5 8-5-8 5-7Zm0 0v15" /></> : mode === "crystal" ? <><path d="m9 5-5 8 12 15 12-15-5-8H9Z" /><path d="M4 13h24M9 5l3 8 4 15 4-15 3-8M12 13l4-8 4 8" /></> : <><circle cx="16" cy="16" r="12" /><path d="m16 4 9 12-9 12-9-12L16 4ZM4 16h24M16 4v24" /></>}
  </svg>;
}

// 상태를 상위 빌더에 보관해 화면을 전환해도 장착 구성과 검색 조건을 유지한다.
export function useAugmentEditor(kind: AugmentKind) {
  const title = kind === "crystal" ? "수정" : "광명석";
  const slots = AUGMENT_SLOTS[kind];
  const allItems = AUGMENT_ITEMS.filter(item => item.kind === kind);
  const [selection, setSelection] = useState<AugmentSelection>({});
  const [slotId, setSlotId] = useState(slots[0].id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [notice, setNotice] = useState("");
  const activeSlot = slots.find(slot => slot.id === slotId)!;
  const activeItem = AUGMENT_BY_ID.get(selection[slotId]);
  const compatible = allItems.filter(item => fitsAugmentSlot(item, activeSlot));
  const normalized = search.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const items = compatible.filter(item => `${item.name} ${item.english} ${augmentGroupLabel(item)}`.normalize("NFKC").toLowerCase().replace(/\s+/g, "").includes(normalized));
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  if (sort === "rarity") items.sort((a, b) => b.rarity - a.rarity);

  function chooseSlot(next: string) {
    setSlotId(next); setSearch(""); setNotice("");
  }
  function selectItem(itemId: string) {
    setSelection(previous => augmentUnavailableReason(kind, previous, slotId, itemId) ? previous : equipAugment(kind, previous, slotId, itemId));
    setNotice("");
  }
  function removeItem() {
    setSelection(previous => removeAugment(kind, previous, slotId)); setNotice("");
  }
  function clearSearch() { setSearch(""); }
  async function copyText() {
    try { await navigator.clipboard.writeText(buildAugmentText(kind, selection)); setNotice(`${title} 목록을 복사했습니다.`); }
    catch { setNotice("복사 권한을 확인해 주세요. 현재 구성은 유지됩니다."); }
  }
  return { kind, title, slots, allItems, selection, slotId, search, setSearch, sort, setSort, notice, activeSlot, activeItem, items, count: Object.keys(selection).length, chooseSlot, selectItem, removeItem, clearSearch, copyText };
}
type AugmentEditorState = ReturnType<typeof useAugmentEditor>;

// 고대 정령은 마법진 정중앙, 아래 별도 6칸은 새벽의 수정이다.
const CRYSTAL_POSITIONS: Record<string, [number, number]> = {
  "crystal-1": [12, 12], "crystal-8": [50, 12], "crystal-2": [88, 12],
  "crystal-3": [31, 31], "crystal-4": [50, 31], "crystal-5": [69, 31],
  "crystal-6": [12, 50], "crystal-7": [31, 50], "crystal-15": [50, 50], "crystal-9": [69, 50], "crystal-10": [88, 50],
  "crystal-11": [31, 69], "crystal-12": [50, 69], "crystal-13": [69, 69],
  "crystal-14": [12, 88], "crystal-16": [50, 88], "crystal-17": [88, 88],
};

export function AugmentBoard({ editor, onSelectSlot }: { editor: AugmentEditorState; onSelectSlot: () => void }) {
  const { kind, slots, selection, slotId, chooseSlot } = editor;
  function slotButton(slot: AugmentSlot, position?: CSSProperties) {
    const equipped = AUGMENT_BY_ID.get(selection[slot.id]);
    return <button key={slot.id} type="button" data-augment-slot={slot.id} data-slot-type={slot.type} style={position}
      className={`${styles.slot} ${slot.id === slotId ? styles.slotActive : ""} ${equipped ? styles.slotEquipped : ""}`}
      aria-pressed={slot.id === slotId} aria-label={`${slot.section} ${slot.label}: ${equipped?.name ?? "미장착"}`}
      title={equipped?.name ?? slot.label} onClick={() => { chooseSlot(slot.id); onSelectSlot(); }}>
      <span className={styles.gem} data-rarity={equipped?.rarity}>
        {equipped ? <Image src={equipped.image} alt="" width={44} height={44} unoptimized /> : <EquipmentModeIcon mode={kind} />}
      </span>
      <span className={styles.slotLabel}>{slot.label}</span>
    </button>;
  }
  return <div className={styles.board} data-augment-board={kind}>
    {kind === "crystal" ? <>
      <div className={styles.crystalOrbit}>
        <svg className={styles.constellation} viewBox="0 0 400 340" fill="none" aria-hidden="true">
          <g transform="translate(0 6)">
            <circle cx="200" cy="164" r="149" /><circle cx="200" cy="164" r="120" /><circle cx="200" cy="164" r="73" /><circle cx="200" cy="164" r="40" />
            <path d="m200 16 128 222H72L200 16Zm0 296L72 90h256L200 312ZM50 164h300M200 16v296M94 58l212 212M94 270 306 58" />
          </g>
        </svg>
        {slots.filter(slot => slot.type !== "kharazad").map(slot => {
          const [x, y] = CRYSTAL_POSITIONS[slot.id];
          return slotButton(slot, { left: `${x}%`, top: `${y}%` });
        })}
      </div>
      <div className={styles.dawnRow} aria-label="새벽의 수정 슬롯"><span className={styles.dawnTitle}>새벽의 수정</span>{slots.filter(slot => slot.type === "kharazad").map(slot => slotButton(slot))}</div>
    </> : <div className={styles.artifacts}>
      {["유물 1", "유물 2"].map(section => <div className={styles.artifact} key={section}>
        <div className={styles.artifactTitle}><Image src="/gear/slots/artifact.png" alt="" width={25} height={25} unoptimized /><h3>{section}</h3><span>LIGHTSTONES</span></div>
        <div className={styles.lightstoneRow}>{slots.filter(slot => slot.section === section).map(slot => slotButton(slot))}</div>
      </div>)}
    </div>}
  </div>;
}

export function AugmentEditor({ editor, onReturnToSlots }: { editor: AugmentEditorState; onReturnToSlots: () => void }) {
  const { kind, title, slotId, selection, search, setSearch, sort, setSort, items, activeSlot, activeItem, allItems, count, notice, selectItem, removeItem, clearSearch, copyText } = editor;
  return <>
    <button type="button" className={ui.mobileBack} onClick={onReturnToSlots}>↑ {title} 슬롯으로</button>
    <div className={ui.filters}>
      <div className={`${ui.selectorTitle} ${styles.selectorTitle}`}><EquipmentModeIcon mode={kind} /><h2>{kind === "lightstone" ? `${activeSlot.section} · ${activeSlot.label}` : activeSlot.label}</h2></div>
      <label className={ui.search}><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" aria-label={`${title} 검색`} placeholder={`${title} 이름 검색`} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label={`${title} 정렬`} value={sort} onChange={event => setSort(event.target.value)}><option value="default">기본순</option><option value="rarity">등급순</option><option value="name">이름순</option></select>
    </div>
    <div className={ui.resultsLabel}><span>{search ? "검색 결과" : `전체 ${title}`} <strong>{items.length}</strong></span><div>{search && <button type="button" className={ui.textButton} onClick={clearSearch}>검색 초기화</button>}{activeItem && <button type="button" className={ui.removeButton} onClick={removeItem}>장착 해제</button>}</div></div>
    <div className={ui.itemGrid} key={`${kind}:${slotId}:${search}:${sort}`} role="group" aria-label={`${title} 목록`}>
      {items.map(item => {
        const reason = augmentUnavailableReason(kind, selection, slotId, item.id);
        const selected = activeItem?.id === item.id;
        return <button type="button" key={item.id} data-augment-item={item.id} className={`${ui.itemCard} ${selected ? ui.itemSelected : ""}`}
          disabled={Boolean(reason)} aria-pressed={selected} title={reason ?? item.name} onClick={() => selectItem(item.id)}>
          <span className={ui.itemIcon} data-rarity={item.rarity}><Image src={item.image} alt="" width={40} height={40} unoptimized /></span>
          <span className={ui.itemText}><span className={ui.itemName}>{item.name}</span><span className={ui.itemHint}>{augmentGroupLabel(item)}{kind === "crystal" && item.limit !== null ? ` · 최대 ${item.limit}개` : ""}</span>{reason && <span className={styles.limit}>계열 장착 한도 도달</span>}</span>
          <span className={ui.check} aria-hidden="true">{selected ? "✓" : "+"}</span>
        </button>;
      })}
    </div>
    {!items.length && <div className={ui.noResults}><p>검색 결과가 없습니다.</p><button type="button" className={ui.button} onClick={clearSearch}>검색 초기화</button></div>}
    <p className={ui.catalogNote}>가모스 한국어 목록 · {allItems.length}종<br />{kind === "crystal" ? "슬롯 해금 완료 기준 · 전용 슬롯과 계열별 장착 제한 적용" : "유물 2개 · 광명석 총 4칸"}</p>
    <div className={ui.summaryFooter}><div><p className={ui.sectionLabel}>{kind === "crystal" ? "MY CRYSTALS" : "MY LIGHTSTONES"}</p><strong>내 {title}</strong><span> · {count}개 장착</span></div><button type="button" className={ui.button} disabled={!count} onClick={copyText}>{title} 목록 복사</button></div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </>;
}
