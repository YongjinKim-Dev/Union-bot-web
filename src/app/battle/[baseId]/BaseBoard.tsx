"use client";

import { useState } from "react";
import type { BattleBaseDetail } from "@/lib/battleQueries";
import styles from "../battle.module.css";
import { MapPanel } from "./MapPanel";
import { SpotBoard } from "./SpotBoard";

/*
 * 거점 한 곳의 지도와 자리. 편집 스위치를 여기 하나만 둔다 — 지도와 자리에
 * 따로 두면 관리자가 두 번 켜고 두 번 꺼야 한다.
 */
export function BaseBoard({ base, isAdmin }: { base: BattleBaseDetail; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      {isAdmin && (
        <div className={styles.editBar}>
          <button
            type="button"
            className={editing ? styles.buttonActive : styles.button}
            onClick={() => setEditing((on) => !on)}
          >
            {editing ? "편집 끝내기" : "편집"}
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <MapPanel
        baseId={base.id}
        baseName={base.name}
        mapKey={base.mapKey}
        mapPublic={base.mapPublic}
        editing={editing}
        onError={setError}
      />

      <SpotBoard
        baseId={base.id}
        spots={base.spots}
        isAdmin={isAdmin}
        editing={editing}
        onError={setError}
      />
    </>
  );
}
