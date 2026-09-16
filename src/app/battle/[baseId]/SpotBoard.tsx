"use client";

import { useState, useTransition } from "react";
import type { BattleSpot } from "@/lib/battleQueries";
import { addSpotAction, deleteSpotAction, saveSpotAction, setSpotActiveAction } from "../actions";
import styles from "../battle.module.css";

const DESCRIPTION_MAX = 500;

/*
 * 자리 한 칸. 사진은 아직 올리지 못하므로 들어갈 자리만 잡아 둔다 — 나중에
 * 업로드를 붙일 때 이 칸의 크기와 배치를 그대로 쓰면 된다.
 */
function SpotCard({
  baseId,
  spot,
  isAdmin,
  editing,
  onError,
}: {
  baseId: string;
  spot: BattleSpot;
  isAdmin: boolean;
  editing: boolean;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(spot.name);
  const [description, setDescription] = useState(spot.description);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = name.trim() !== spot.name || description.trim() !== spot.description;

  function save() {
    onError("");
    setSaved(false);
    startTransition(async () => {
      try {
        await saveSpotAction(baseId, spot.id, name, description);
        setSaved(true);
      } catch {
        onError("저장하지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <article className={spot.isActive ? styles.spot : styles.spotOff}>
      {/* 사진 자리. 업로드를 붙이기 전까지는 비어 있다는 것만 알려 준다. */}
      <div className={styles.shot}>
        <span className={styles.shotNote}>스크린샷 자리</span>
      </div>

      <div className={styles.spotBody}>
        {editing ? (
          <>
            <input
              className={styles.input}
              value={name}
              aria-label="자리 이름"
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
            <textarea
              className={styles.textarea}
              value={description}
              aria-label="자리 설명"
              rows={3}
              maxLength={DESCRIPTION_MAX}
              placeholder="짧은 설명"
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className={styles.spotActions}>
              <span className={styles.counter}>
                {description.length}/{DESCRIPTION_MAX}
              </span>
              {saved && !dirty && <span className={styles.savedNote}>저장됨</span>}
              <button
                type="button"
                className={styles.miniButton}
                disabled={!dirty || isPending || !name.trim()}
                onClick={save}
              >
                저장
              </button>
              <button
                type="button"
                className={styles.miniButton}
                disabled={isPending}
                onClick={() => {
                  onError("");
                  startTransition(async () => {
                    try {
                      await setSpotActiveAction(baseId, spot.id, !spot.isActive);
                    } catch {
                      onError("바꾸지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
                    }
                  });
                }}
              >
                {spot.isActive ? "내리기" : "올리기"}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `"${spot.name}" 칸을 삭제합니다. 되돌릴 수 없습니다.\n\n기록으로 남겨야 한다면 "내리기"를 쓰세요.`,
                    )
                  ) {
                    return;
                  }
                  onError("");
                  startTransition(async () => {
                    try {
                      await deleteSpotAction(baseId, spot.id);
                    } catch {
                      onError("삭제하지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
                    }
                  });
                }}
              >
                삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className={styles.spotName}>
              {spot.name}
              {!spot.isActive && <span className={styles.offBadge}>내림</span>}
            </h3>
            {spot.description ? (
              <p className={styles.spotText}>{spot.description}</p>
            ) : (
              <p className={styles.spotTextEmpty}>
                {isAdmin ? "편집을 눌러 설명을 적어 주세요." : "설명이 아직 없습니다."}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function SpotBoard({
  baseId,
  spots,
  isAdmin,
}: {
  baseId: string;
  spots: BattleSpot[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>주요 자리</h2>
        {isAdmin && (
          <button
            type="button"
            className={editing ? styles.buttonActive : styles.button}
            onClick={() => setEditing((on) => !on)}
          >
            {editing ? "편집 끝내기" : "편집"}
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {spots.length === 0 ? (
        <p className={styles.empty}>등록된 자리가 없습니다.</p>
      ) : (
        <div className={styles.spotGrid}>
          {spots.map((spot) => (
            <SpotCard
              key={spot.id}
              baseId={baseId}
              spot={spot}
              isAdmin={isAdmin}
              editing={editing}
              onError={setError}
            />
          ))}
        </div>
      )}

      {editing && (
        <div className={styles.nameField}>
          <input
            className={styles.input}
            value={newName}
            placeholder="자리 추가"
            aria-label="자리 추가"
            maxLength={60}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            type="button"
            className={styles.miniButton}
            disabled={!newName.trim() || isPending}
            onClick={() => {
              const name = newName.trim();
              setNewName("");
              setError("");
              startTransition(async () => {
                try {
                  await addSpotAction(baseId, name);
                } catch {
                  setError("추가하지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
                }
              });
            }}
          >
            추가
          </button>
        </div>
      )}
    </section>
  );
}
