"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchClassesByType, registerCharacterClass } from "./actions";
import { ClassIcon } from "@/components/ClassIcon";
import {
  CLASS_TYPE_LABEL,
  CLASS_TYPE_SUBLABEL,
  type ClassType,
  type DbCharacterClass,
} from "@/lib/types";
import styles from "./classes.module.css";

const BRANCHES = Object.keys(CLASS_TYPE_LABEL) as ClassType[];

export function ClassRegistration({
  initialType,
  initialName,
}: {
  initialType: ClassType | null;
  initialName: string | null;
}) {
  const [branch, setBranch] = useState<ClassType | null>(initialType);
  const [classes, setClasses] = useState<DbCharacterClass[]>([]);
  const [selected, setSelected] = useState<DbCharacterClass | null>(null);
  // What is actually stored right now, so the summary can tell "이미 등록됨"
  // apart from an unsaved pick.
  const [registeredName, setRegisteredName] = useState<string | null>(initialName);
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function loadClasses(type: ClassType, preselectName: string | null) {
    startLoad(async () => {
      setClasses([]);
      const result = await fetchClassesByType(type);
      setClasses(result);
      if (preselectName) {
        setSelected(result.find((c) => c.name === preselectName) ?? null);
      }
    });
  }

  // Arriving from "변경" with a class already registered: open step 2 on that
  // branch with the current class highlighted.
  useEffect(() => {
    if (initialType) {
      loadClasses(initialType, initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBranch(type: ClassType) {
    if (type === branch) return;
    setBranch(type);
    setSelected(null); // switching branch clears the class pick
    setError(null);
    setDone(false);
    loadClasses(type, null);
  }

  function handleReset() {
    setBranch(null);
    setClasses([]);
    setSelected(null);
    setError(null);
    setDone(false);
  }

  function handleSubmit() {
    if (!selected) return;
    setError(null);
    startSave(async () => {
      try {
        await registerCharacterClass(selected.id);
        setRegisteredName(selected.name);
        setDone(true);
      } catch {
        setError("DB 오류. 직업 등록에 실패했습니다.");
      }
    });
  }

  const canSubmit = branch !== null && selected !== null && !isSaving;

  let summary: string;
  let summaryTone: string;
  if (branch && selected) {
    summary = `${CLASS_TYPE_LABEL[branch]} · ${selected.name}`;
    summaryTone = styles.summaryStrong;
  } else if (branch) {
    summary = `${CLASS_TYPE_LABEL[branch]} · 직업 미선택`;
    summaryTone = styles.summaryDim;
  } else {
    summary = "선택 없음";
    summaryTone = styles.summaryDim;
  }

  const stepTwoHint = branch
    ? `${CLASS_TYPE_LABEL[branch]} · ${classes.length}개 직업`
    : "계열을 먼저 선택하세요";

  return (
    <>
      <div className={styles.body}>
        <section>
          <span className={styles.kicker}>STEP 01</span>
          <h2 className={styles.stepTitle}>계열 선택</h2>
          <div className={styles.branchRow}>
            {BRANCHES.map((type, index) => (
              <button
                key={type}
                type="button"
                className={`${styles.branchCard} ${branch === type ? styles.branchCardSelected : ""}`}
                onClick={() => handleBranch(type)}
              >
                <span className={styles.branchNum}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.branchLabel}>{CLASS_TYPE_LABEL[type]}</span>
                <span className={styles.branchSub}>{CLASS_TYPE_SUBLABEL[type]}</span>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.divider} />

        {/* Dimmed until a branch is picked. No aria-disabled here: the role is
            implicit "region", which doesn't support it — and with no branch the
            grid is empty, so there's nothing focusable to guard. The hint text
            carries the state for screen readers. */}
        <section className={`${styles.stepTwo} ${branch ? styles.stepTwoActive : ""}`}>
          <div className={styles.stepTwoHeader}>
            <div>
              <span className={styles.kicker}>STEP 02</span>
              <h2 className={styles.stepTitle}>직업 선택</h2>
            </div>
            <span className={styles.stepTwoHint}>{stepTwoHint}</span>
          </div>

          {branch && isLoading && classes.length === 0 ? (
            <p className={styles.loading}>불러오는 중...</p>
          ) : (
            <div className={styles.classGrid}>
              {classes.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.classTile} ${isSelected ? styles.classTileSelected : ""}`}
                    disabled={isSaving}
                    onClick={() => {
                      setSelected(c);
                      setDone(false);
                    }}
                  >
                    <ClassIcon
                      name={c.name}
                      type={c.type}
                      tone={isSelected ? "selected" : "default"}
                    />
                    <span className={styles.classTileName}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className={styles.footer}>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryKicker}>선택한 직업</span>
          <div className={`${styles.summary} ${summaryTone}`}>{summary}</div>
        </div>
        <div className={styles.footerActions}>
          {error && <span className={styles.error}>{error}</span>}
          {done && !error && (
            <span className={styles.done}>{registeredName} 등록 완료.</span>
          )}
          <button type="button" className={styles.resetButton} onClick={handleReset}>
            초기화
          </button>
          <button
            type="button"
            className={styles.submitButton}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSaving ? "등록 중..." : "등록하기"}
          </button>
        </div>
      </div>
    </>
  );
}
