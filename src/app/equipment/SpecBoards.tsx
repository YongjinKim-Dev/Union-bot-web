"use client";

import Image from "next/image";
import {
  EQUIPMENT_SLOTS, EQUIPMENT_BY_ID, AP_BASIS_LABEL, enhancementOptions, equippedItemName,
  type EquipmentBuild, type EquipmentSheetStats, type EquipmentSlot, type EquipmentSlotId,
} from "@/lib/equipment";
import styles from "./equipment.module.css";
import { EquipmentModeIcon, type EquipmentMode } from "./AugmentPanels";

/*
 * 장비 판·화면 전환·표기 공방은 두 곳에서 쓴다 — 연맹원이 세팅을 만드는
 * 화면과, 관리자가 낸 스펙을 펼쳐 보는 화면.
 *
 * onSelect 를 주지 않으면 보기 전용이다. 그때는 버튼이 아니라 그림으로
 * 그린다. 눌러도 아무 일이 없는 버튼은 눌러도 되는 것처럼 보인다.
 */
export function GearBoard({ build, activeSlotId, onSelect }: {
  build: EquipmentBuild;
  activeSlotId?: EquipmentSlotId;
  onSelect?: (slotId: EquipmentSlotId) => void;
}) {
  function slotContent(s: EquipmentSlot) {
    const selection = build.equipment[s.id];
    const equipped = selection && EQUIPMENT_BY_ID.get(selection.itemId);
    const level = equipped && selection ? enhancementOptions(equipped.enhancementKind)[selection.enhancement] : "0";
    return { selection, equipped, level, node: (
      <>
        <span className={styles.slotIcon} data-rarity={equipped?.rarity}>
          <Image src={equipped ? `/gear/items/${equipped.id}.webp` : `/gear/slots/${s.category}.png`} alt="" width={48} height={48} unoptimized />
          {level !== "0" && <span className={styles.slotLevel}>{level}</span>}
          {selection && selection.caphras > 0 && <span className={styles.slotCaphras}>C{selection.caphras}</span>}
        </span>
        <span className={styles.slotLabel}>{s.label}</span>
      </>
    ) };
  }

  return (
    <div className={styles.gearBoard}>
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.boardMark} aria-hidden="true"><svg viewBox="0 0 100 124" fill="none"><path d="M50 5 91 23v36c0 28-23 49-41 61C32 108 9 87 9 59V23L50 5Z" stroke="currentColor" strokeWidth="1.5" /><path d="m50 24 22 42-22 33-22-33 22-42Z" stroke="currentColor" /><path d="M50 24v75M28 66h44" stroke="currentColor" /></svg></div>
      {EQUIPMENT_SLOTS.map(s => {
        const { selection, equipped, node } = slotContent(s);
        const label = `${s.label}: ${equipped && selection ? equippedItemName(equipped, selection.enhancement) : "미장착"}`;
        const shared = `${styles.slot} ${s.id === activeSlotId ? styles.slotActive : ""} ${equipped ? styles.slotEquipped : ""}`;
        const position = { left: `${s.x}%`, top: `${s.y}%` };
        if (!onSelect) {
          return <div key={s.id} data-slot={s.id} className={`${shared} ${styles.slotStatic}`} style={position} role="img" aria-label={label} title={label}>{node}</div>;
        }
        return (
          <button key={s.id} type="button" data-slot={s.id} className={shared} style={position}
            aria-pressed={s.id === activeSlotId} aria-label={label}
            title={equipped?.name ?? s.label} onClick={() => onSelect(s.id)}>
            {node}
          </button>
        );
      })}
    </div>
  );
}

const MODES = [["gear", "장비"], ["crystal", "수정"], ["lightstone", "광명석"]] as const;

export function SpecModeButtons({ mode, onChange }: { mode: EquipmentMode; onChange: (next: EquipmentMode) => void }) {
  return (
    <div className={styles.modeButtons} role="group" aria-label="장착 화면 전환">
      {MODES.map(([value, label]) => (
        <button key={value} type="button" data-equipment-mode-button={value} aria-pressed={mode === value}
          className={mode === value ? styles.modeActive : ""} title={`${label} 장착 화면`} onClick={() => onChange(value)}>
          <EquipmentModeIcon mode={value} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

const SHEET_ROWS = [
  ["ap", "주무기", "주무기 공격력"], ["aap", "각성무기", "각성무기 공격력"],
  ["dp", "방어력", "표기 방어력"], ["score", "공방합", "직업이 쓰는 공격력 + 방어력"],
] as const;

export function SpecSheet({ stats }: { stats: EquipmentSheetStats }) {
  // 공방합만 두 가지 이유로 빌 수 있다. 수치를 모르는 장비가 있거나, 직업이 없거나.
  const scoreReady = stats.complete && stats.basis !== null;
  const note = !stats.complete
    ? "수치를 확인하지 못한 장비가 있어 합계를 표시하지 않습니다."
    : stats.basis === null
      ? "직업을 등록하면 공방합이 나옵니다. 직업에 따라 주무기와 각성무기 중 어느 쪽을 보는지가 달라집니다."
      : `공방합 = ${AP_BASIS_LABEL[stats.basis]} + 방어력`;
  return (
    <>
      <div className={styles.sheetHeading}>
        <span>표기 공격력 · 방어력</span>
        <span>{stats.basis === null ? "내실 전체 완료" : `${AP_BASIS_LABEL[stats.basis]} 기준`}</span>
      </div>
      <dl className={styles.sheetStats} aria-label="표기 공방" aria-live="polite" aria-atomic="true">
        {SHEET_ROWS.map(([key, label, description]) => {
          const shown = key === "score" ? scoreReady : stats.complete;
          const used = (key === "ap" && stats.basis === "main") || (key === "aap" && stats.basis === "awakening");
          return (
            <div key={key} className={key === "score" ? styles.scoreStat : used ? styles.usedStat : undefined}>
              <dt><abbr title={description}>{label}</abbr>{used && <span className={styles.usedMark} title="공방합에 쓰이는 값"> ●</span>}</dt>
              <dd data-stat={key}>{shown ? stats[key] : "—"}</dd>
            </div>
          );
        })}
      </dl>
      <p className={styles.sheetNote}>{note}<br />레벨 60 이상 · 일지·영구 보상 완료 (주무기·각성무기·방어력 각 +12)</p>
    </>
  );
}
