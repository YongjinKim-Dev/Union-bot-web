"use client";

import { useState, useTransition } from "react";
import { fetchClassesByType, selectCharacterClass } from "./actions";
import { CLASS_TYPE_LABEL, type ClassType, type DbCharacterClass } from "@/lib/types";
import styles from "./vote.module.css";

const CLASS_TYPES = Object.keys(CLASS_TYPE_LABEL) as ClassType[];

export function ClassSelector({
  onSelected,
}: {
  onSelected: (name: string, type: ClassType) => void;
}) {
  const [classType, setClassType] = useState<ClassType | "">("");
  const [classes, setClasses] = useState<DbCharacterClass[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(value: string) {
    const type = value as ClassType;
    setClassType(type);
    setClasses([]);
    setError(null);
    startTransition(async () => {
      const result = await fetchClassesByType(type);
      setClasses(result);
    });
  }

  function handleClassChange(value: string) {
    if (!value) return;
    const chosen = classes.find((c) => c.id === value);
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      try {
        await selectCharacterClass(chosen.id);
        onSelected(chosen.name, chosen.type);
      } catch {
        setError("DB 오류. 직업 정보 변경 실패.");
      }
    });
  }

  return (
    <div className={styles.classSelector}>
      <select
        className={styles.select}
        value={classType}
        onChange={(e) => handleTypeChange(e.target.value)}
        disabled={isPending}
      >
        <option value="" disabled>
          참가 직업 종류를 고르세요
        </option>
        {CLASS_TYPES.map((type) => (
          <option key={type} value={type}>
            {CLASS_TYPE_LABEL[type]}
          </option>
        ))}
      </select>

      {classType && (
        <select
          className={styles.select}
          defaultValue=""
          onChange={(e) => handleClassChange(e.target.value)}
          disabled={isPending || classes.length === 0}
        >
          <option value="" disabled>
            {classes.length === 0 ? "불러오는 중..." : "직업을 선택해주세요."}
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
