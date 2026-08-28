"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchClassesByType, selectCharacterClass } from "./actions";
import { ClassIcon } from "@/components/ClassIcon";
import { CLASS_TYPE_LABEL, type ClassType, type DbCharacterClass } from "@/lib/types";
import styles from "./vote.module.css";

const CLASS_TYPES = Object.keys(CLASS_TYPE_LABEL) as ClassType[];

export function ClassSelector({
  initialType,
  initialName,
  onSelected,
}: {
  initialType?: ClassType | null;
  initialName?: string | null;
  onSelected: (name: string, type: ClassType) => void;
}) {
  const [classType, setClassType] = useState<ClassType | null>(initialType ?? null);
  const [classes, setClasses] = useState<DbCharacterClass[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(initialName ?? null);
  const [isLoading, startLoadTransition] = useTransition();
  const [isSelecting, startSelectTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadClasses(type: ClassType) {
    startLoadTransition(async () => {
      setClasses([]);
      const result = await fetchClassesByType(type);
      setClasses(result);
    });
  }

  // Editing an already-registered class: jump straight to step 2 with the
  // matching weapon type's grid pre-loaded.
  useEffect(() => {
    if (initialType) {
      loadClasses(initialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTypeSelect(type: ClassType) {
    setClassType(type);
    setError(null);
    loadClasses(type);
  }

  function handleClassSelect(characterClass: DbCharacterClass) {
    setError(null);
    startSelectTransition(async () => {
      try {
        await selectCharacterClass(characterClass.id);
        setSelectedName(characterClass.name);
        onSelected(characterClass.name, characterClass.type);
      } catch {
        setError("DB 오류. 직업 정보 변경 실패.");
      }
    });
  }

  if (!classType) {
    return (
      <div className={styles.classStep}>
        <div className={styles.classTypeRow}>
          {CLASS_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={styles.classTypeButton}
              onClick={() => handleTypeSelect(type)}
            >
              {CLASS_TYPE_LABEL[type]}
            </button>
          ))}
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.classStep}>
      <button
        type="button"
        className={styles.classBackButton}
        onClick={() => {
          setClassType(null);
          setClasses([]);
        }}
      >
        ‹ 직업 종류 다시 선택
      </button>

      {isLoading && classes.length === 0 ? (
        <p className={styles.notice}>불러오는 중...</p>
      ) : (
        <div className={styles.classGrid}>
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.classCard} ${selectedName === c.name ? styles.classCardSelected : ""}`}
              disabled={isSelecting}
              onClick={() => handleClassSelect(c)}
            >
              <ClassIcon
                name={c.name}
                type={c.type}
                tone={selectedName === c.name ? "selected" : "default"}
              />
              <span className={styles.classCardLabel}>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
