"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const URGENT_MS = 60 * 60 * 1000;

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function HeroCountdown({ label, targetMs }: { label: string; targetMs: number }) {
  const [leftMs, setLeftMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeftMs(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const value = leftMs === null ? null : format(leftMs);
  const urgent = leftMs !== null && leftMs < URGENT_MS;

  return (
    <div>
      <span className={styles.heroKicker}>{label}</span>
      {/* 처음엔 빈칸 → 시계가 돌기 시작하면 숫자 표시 (새로고침 때 화면 어긋남 방지) */}
      <div className={`${styles.heroTimer} ${urgent ? styles.heroTimerUrgent : ""}`}>
        {value ?? " "}
      </div>
    </div>
  );
}

function format(leftMs: number) {
  const total = Math.floor(leftMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}
