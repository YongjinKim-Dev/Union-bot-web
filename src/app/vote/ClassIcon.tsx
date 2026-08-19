"use client";

import { useState } from "react";
import { DEFAULT_CLASS_ICON, getClassIconPath } from "@/lib/classIconMap";
import styles from "./vote.module.css";

type Stage = "primary" | "default" | "placeholder";

export function ClassIcon({ name, size = 48 }: { name: string; size?: number }) {
  const primarySrc = getClassIconPath(name);
  const [stage, setStage] = useState<Stage>(primarySrc === DEFAULT_CLASS_ICON ? "default" : "primary");

  if (stage === "placeholder") {
    return (
      <div
        className={styles.classIconPlaceholder}
        style={{ width: size, height: size }}
        role="img"
        aria-label={name}
      />
    );
  }

  const src = stage === "primary" ? primarySrc : DEFAULT_CLASS_ICON;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- runtime fallback chain (class icon -> default -> gray box) needs a plain onError handler; these are small static icons that don't need next/image's optimizer.
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={styles.classIconImg}
      onError={() => setStage((current) => (current === "primary" ? "default" : "placeholder"))}
    />
  );
}
