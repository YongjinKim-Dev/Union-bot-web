"use client";

import Image from "next/image";
import { useState } from "react";
import {
  EQUIPMENT_SLOTS, EQUIPMENT_BY_ID, equippedItemName, calculateEquipmentStats,
  type ApBasis, type EquipmentBuild,
} from "@/lib/equipment";
import { AUGMENT_SLOTS, AUGMENT_BY_ID, augmentGroupLabel } from "@/lib/equipmentAugments";
import styles from "./equipment.module.css";
import { AugmentBoard, type EquipmentMode } from "./AugmentPanels";
import { LightstoneCombinations } from "./LightstoneCombinations";
import { GearBoard, SpecModeButtons, SpecSheet } from "./SpecBoards";

/*
 * 낸 스펙을 보기만 하는 화면. 세팅 화면과 같은 판을 쓰고 고르는 기능만 뺐다.
 * 장비·수정·광명석 전환은 그대로 두어야 무엇을 냈는지 다 볼 수 있다.
 */
export function SpecViewer({ build, basis }: { build: EquipmentBuild; basis: ApBasis | null }) {
  const [mode, setMode] = useState<EquipmentMode>("gear");
  const stats = calculateEquipmentStats(build, basis);
  const selection = mode === "lightstone" ? build.lightstones : build.crystals;

  const rows = mode === "gear"
    ? EQUIPMENT_SLOTS.flatMap(slot => {
        const equipped = build.equipment[slot.id];
        const item = equipped && EQUIPMENT_BY_ID.get(equipped.itemId);
        if (!equipped || !item) return [];
        return [{
          key: slot.id, label: slot.label,
          name: equippedItemName(item, equipped.enhancement),
          hint: equipped.caphras ? `카프라스 ${equipped.caphras}단계` : "",
          image: `/gear/items/${item.id}.webp`, rarity: item.rarity,
        }];
      })
    : AUGMENT_SLOTS[mode === "crystal" ? "crystal" : "lightstone"].flatMap(slot => {
        const item = AUGMENT_BY_ID.get(selection[slot.id]);
        if (!item) return [];
        return [{
          key: slot.id, label: mode === "lightstone" ? `${slot.section} · ${slot.label}` : slot.label,
          name: item.name, hint: augmentGroupLabel(item),
          image: item.image, rarity: item.rarity,
        }];
      });

  const total = mode === "gear" ? EQUIPMENT_SLOTS.length : AUGMENT_SLOTS[mode].length;

  return (
    <div className={styles.viewer}>
      <div className={styles.viewerBoard}>
        {mode === "gear"
          ? <GearBoard build={build} />
          : <AugmentBoard kind={mode} selection={selection} />}
        {mode === "lightstone" && <LightstoneCombinations selection={build.lightstones} />}
        <SpecModeButtons mode={mode} onChange={setMode} />
        <SpecSheet stats={stats} />
      </div>
      <div className={styles.viewerList}>
        <div className={styles.panelHeading}>
          <span className={styles.sectionLabel}>{mode === "gear" ? "EQUIPMENT" : mode === "crystal" ? "CRYSTALS" : "LIGHTSTONES"}</span>
          <span className={styles.counter}>{rows.length}<span> / {total}</span></span>
        </div>
        {rows.length ? (
          <ul className={styles.viewerRows}>
            {rows.map(row => (
              <li key={row.key}>
                <span className={styles.itemIcon} data-rarity={row.rarity}>
                  <Image src={row.image} alt="" width={34} height={34} unoptimized />
                </span>
                <span className={styles.viewerText}>
                  <span className={styles.viewerName}>{row.name}</span>
                  <span className={styles.viewerHint}>{row.label}{row.hint ? ` · ${row.hint}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className={styles.viewerEmpty}>장착한 것이 없습니다.</p>}
      </div>
    </div>
  );
}
