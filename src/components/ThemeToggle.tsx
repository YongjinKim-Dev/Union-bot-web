"use client";

import { useSyncExternalStore } from "react";
import { getServerTheme, getTheme, subscribeTheme, toggleTheme } from "./theme";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle({ floating = false, compact = false }: { floating?: boolean; compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  return (
    <button
      type="button"
      role="switch"
      aria-label="다크 모드"
      aria-checked={theme === "dark"}
      title={compact ? (theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환") : undefined}
      className={`${styles.toggle} ${floating ? styles.floating : ""} ${compact ? styles.compact : ""}`}
      onClick={toggleTheme}
    >
      <svg className={styles.sun} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </svg>
      <svg className={styles.moon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
      </svg>
      {!compact && <>
        <span className={styles.sun}>밝은 테마</span>
        <span className={styles.moon}>어두운 테마</span>
        <span className={styles.track} aria-hidden="true"><span /></span>
      </>}
    </button>
  );
}
