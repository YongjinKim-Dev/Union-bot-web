"use client";

import { useRef, useState, useTransition } from "react";
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

const DESCRIPTION_MAX = 500;

/*
 * 사진 올리기.
 *
 * 공개 여부는 올릴 때 함께 넘긴다. 기본은 꺼짐 — 로그인한 사람만 본다.
 * 켜면 주소를 아는 사람은 누구나 받을 수 있으므로 밖에 나가도 되는 사진만
 * 켠다. 이미 올린 사진의 공개 여부만 바꾸는 것은 파일을 건드리지 않는다.
 */
function ImageField({
  baseId,
  spot,
  onError,
}: {
  baseId: string;
  spot: BattleSpot;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(spot.imagePublic);
  const [isPending, startTransition] = useTransition();

  function upload() {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    onError("");
    startTransition(async () => {
      const result = await uploadSpotImageAction(baseId, spot.id, form, open);
      if (result.ok) {
        setFile(null);
        if (input.current) input.current.value = "";
      } else {
        onError(result.message);
      }
    });
  }

  return (
    <div className={styles.imageField}>
      <div className={styles.imageRow}>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.file}
          aria-label="스크린샷 고르기"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className={styles.miniButton}
          disabled={!file || isPending}
          onClick={upload}
        >
          올리기
        </button>
      </div>
      <div className={styles.imageRow}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => {
              const next = event.target.checked;
              setOpen(next);
              // 이미 사진이 있으면 켜고 끄는 즉시 반영한다. 아직 없으면 다음에
              // 올릴 사진에 이 값이 함께 넘어간다.
              if (!spot.imageKey) return;
              onError("");
              startTransition(async () => {
                try {
                  await setSpotImagePublicAction(baseId, spot.id, next);
                } catch {
                  setOpen(!next);
                  onError("바꾸지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
                }
              });
            }}
          />
          로그인 없이도 보이기
        </label>
        {spot.imageKey && (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={isPending}
            onClick={() => {
              if (!window.confirm(`"${spot.name}" 사진을 지웁니다. 되돌릴 수 없습니다.`)) return;
              onError("");
              startTransition(async () => {
                try {
                  await clearSpotImageAction(baseId, spot.id);
                } catch {
                  onError("지우지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
                }
              });
            }}
          >
            사진 지우기
          </button>
        )}
      </div>
    </div>
  );
}

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
            <ImageField baseId={baseId} spot={spot} onError={onError} />
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
