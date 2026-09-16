"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BattleRegion } from "@/lib/battleQueries";
import {
  addBaseAction,
  addRegionAction,
  deleteBaseAction,
  deleteRegionAction,
  renameBaseAction,
  renameRegionAction,
  setBaseActiveAction,
  setRegionActiveAction,
} from "./actions";
import styles from "./battle.module.css";

type Tab = "거점전" | "공성전";

/* 되돌릴 수 없는 일은 누르기 전에 한 번 묻는다. 내리기와 나란히 있어서
   손이 미끄러질 자리이기도 하다. */
function confirmDelete(message: string): boolean {
  return window.confirm(`${message}\n\n기록으로 남겨야 한다면 "내리기"를 쓰세요.`);
}
const TABS: Tab[] = ["거점전", "공성전"];

/** 이름 한 칸. 고친 뒤에만 저장이 살아나 실수로 같은 값을 다시 쓰지 않는다. */
function NameField({
  value,
  label,
  max,
  onSave,
}: {
  value: string;
  label: string;
  max: number;
  onSave: (next: string) => void;
}) {
  const [text, setText] = useState(value);
  const next = text.trim();
  const dirty = next.length > 0 && next !== value;
  return (
    <div className={styles.nameField}>
      <input
        className={styles.input}
        value={text}
        aria-label={label}
        maxLength={max}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) onSave(next);
        }}
      />
      <button type="button" className={styles.miniButton} disabled={!dirty} onClick={() => onSave(next)}>
        저장
      </button>
    </div>
  );
}

function AddField({
  placeholder,
  max,
  onAdd,
}: {
  placeholder: string;
  max: number;
  onAdd: (name: string) => void;
}) {
  const [text, setText] = useState("");
  const name = text.trim();
  return (
    <div className={styles.nameField}>
      <input
        className={styles.input}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={max}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name) {
            onAdd(name);
            setText("");
          }
        }}
      />
      <button
        type="button"
        className={styles.miniButton}
        disabled={!name}
        onClick={() => {
          onAdd(name);
          setText("");
        }}
      >
        추가
      </button>
    </div>
  );
}

export function BattleHub({ regions, isAdmin }: { regions: BattleRegion[]; isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>("거점전");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  /* 관리자 액션은 requireAdmin 이 throw 한다. 화면이 조용히 아무것도 안 한 것처럼
     보이지 않게 메시지로 받아 둔다. */
  function run(action: () => Promise<unknown>) {
    setError("");
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("바꾸지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <span className={styles.kicker}>BATTLE</span>
          <h1 className={styles.title}>거점전 / 공성전</h1>
          <p className={styles.lead}>
            지역을 고르고 거점에 들어가면 주요 자리와 설명이 있습니다. 거점마다 댓글을 달 수 있습니다.
          </p>
        </div>
        {isAdmin && tab === "거점전" && (
          <button
            type="button"
            className={editing ? styles.buttonActive : styles.button}
            onClick={() => setEditing((on) => !on)}
          >
            {editing ? "편집 끝내기" : "편집"}
          </button>
        )}
      </header>

      <nav className={styles.tabs}>
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={tab === name ? styles.tabActive : styles.tab}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      {error && <p className={styles.error}>{error}</p>}

      {tab === "공성전" ? (
        <p className={styles.empty}>공성전 자리는 아직 준비 중입니다.</p>
      ) : regions.length === 0 ? (
        <p className={styles.empty}>등록된 지역이 없습니다.</p>
      ) : (
        <div className={styles.regions}>
          {regions.map((region) => (
            <section
              key={region.id}
              className={region.isActive ? styles.region : styles.regionOff}
            >
              <div className={styles.regionHead}>
                {editing ? (
                  <NameField
                    value={region.name}
                    label="지역 이름"
                    max={40}
                    onSave={(name) => run(() => renameRegionAction(region.id, name))}
                  />
                ) : (
                  <h2 className={styles.regionName}>{region.name}</h2>
                )}
                <div className={styles.regionMeta}>
                  {!region.isActive && <span className={styles.offBadge}>내림</span>}
                  <span className={styles.count}>거점 {region.bases.length}곳</span>
                  {editing && (
                    <>
                      <button
                        type="button"
                        className={styles.miniButton}
                        disabled={isPending}
                        onClick={() => run(() => setRegionActiveAction(region.id, !region.isActive))}
                      >
                        {region.isActive ? "내리기" : "올리기"}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={isPending}
                        onClick={() => {
                          if (!confirmDelete(`"${region.name}" 지역을 삭제합니다. 거점 ${region.bases.length}곳과 그 안의 자리·댓글까지 함께 사라지고 되돌릴 수 없습니다.`)) return;
                          run(() => deleteRegionAction(region.id));
                        }}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.baseGrid}>
                {region.bases.map((base) => (
                  <div
                    key={base.id}
                    className={base.isActive ? styles.baseCard : styles.baseCardOff}
                  >
                    <Link href={`/battle/${base.id}`} className={styles.baseLink}>
                      <span className={styles.baseName}>{base.name}</span>
                      <span className={styles.baseStat}>
                        자리 {base.filledSpots}/{base.spotCount}
                        {base.commentCount > 0 && ` · 댓글 ${base.commentCount}`}
                      </span>
                      {base.filledSpots === 0 && <span className={styles.baseEmpty}>아직 비어 있음</span>}
                    </Link>
                    {editing && (
                      <div className={styles.baseEdit}>
                        <NameField
                          value={base.name}
                          label="거점 이름"
                          max={40}
                          onSave={(name) => run(() => renameBaseAction(base.id, name))}
                        />
                        <button
                          type="button"
                          className={styles.miniButton}
                          disabled={isPending}
                          onClick={() => run(() => setBaseActiveAction(base.id, !base.isActive))}
                        >
                          {base.isActive ? "내리기" : "올리기"}
                        </button>
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={isPending}
                          onClick={() => {
                            if (!confirmDelete(`"${base.name}" 거점을 삭제합니다. 자리 ${base.spotCount}칸과 댓글 ${base.commentCount}개까지 함께 사라지고 되돌릴 수 없습니다.`)) return;
                            run(() => deleteBaseAction(base.id));
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {editing && (
                <AddField
                  placeholder="거점 추가"
                  max={40}
                  onAdd={(name) => run(() => addBaseAction(region.id, name))}
                />
              )}
            </section>
          ))}

          {editing && (
            <AddField placeholder="지역 추가" max={40} onAdd={(name) => run(() => addRegionAction(name))} />
          )}
        </div>
      )}
    </div>
  );
}
