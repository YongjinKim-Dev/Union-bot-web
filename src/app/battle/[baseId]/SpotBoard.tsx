"use client";

import { useState, useTransition } from "react";
import type { BattleSpot } from "@/lib/battleQueries";
import {
  addSpotAction,
  clearSpotImageAction,
  deleteSpotAction,
  saveSpotAction,
  setSpotActiveAction,
  setSpotImagePublicAction,
  uploadSpotImageAction,
} from "../actions";
import styles from "../battle.module.css";
import { ImageUploader } from "./ImageUploader";

const DESCRIPTION_MAX = 500;

/* 자리 한 칸. 사진과 짧은 설명이 붙는다. */
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
      <div className={styles.shot}>
        {spot.imageKey ? (
          /* eslint-disable-next-line @next/next/no-img-element -- 로그인 확인을 거쳐 우리 길로 내주는 사진이라 next/image 의 최적화 경로를 타지 않는다. */
          <img
            src={`/api/battle-image/${spot.id}`}
            alt={spot.name}
            className={styles.shotImg}
          />
        ) : (
          <span className={styles.shotNote}>스크린샷 자리</span>
        )}
        {spot.imageKey && spot.imagePublic && <span className={styles.openBadge}>공개</span>}
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
            <ImageUploader
              label={`"${spot.name}" 사진`}
              hasImage={spot.imageKey !== null}
              isPublic={spot.imagePublic}
              upload={(form, isPublic) => uploadSpotImageAction(baseId, spot.id, form, isPublic)}
              clear={() => clearSpotImageAction(baseId, spot.id)}
              setPublic={(isPublic) => setSpotImagePublicAction(baseId, spot.id, isPublic)}
              onError={onError}
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

/*
 * 주요 자리 목록. 편집 스위치와 오류 표시는 위에서(BaseBoard) 받는다 —
 * 지도와 자리를 한 번에 켜고 끄려고 스위치를 한 곳에 모았다.
 */
export function SpotBoard({
  baseId,
  spots,
  isAdmin,
  editing,
  onError,
}: {
  baseId: string;
  spots: BattleSpot[];
  isAdmin: boolean;
  editing: boolean;
  onError: (message: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>주요 자리</h2>
      </div>

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
              onError={onError}
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
              onError("");
              startTransition(async () => {
                try {
                  await addSpotAction(baseId, name);
                } catch {
                  onError("추가하지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
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
