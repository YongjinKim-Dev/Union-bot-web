"use client";

import { useState } from "react";
import { DEFAULT_CLASS_ICON, getClassIconPath } from "@/lib/classIconMap";
import { getClassMark } from "@/lib/classMarkMap";
import type { ClassType } from "@/lib/types";
import styles from "./ClassIcon.module.css";

type Stage = "primary" | "default" | "placeholder";

export type ClassIconTone = "default" | "selected" | "dark";

const TONE_CLASS: Record<ClassIconTone, string> = {
  default: styles.toneDefault,
  selected: styles.toneSelected,
  dark: styles.toneDark,
};

/** Mark art is pixel-based and must never render above 22px. */
const MAX_MARK_SIZE = 22;

export function ClassIcon({
  name,
  type = null,
  size = 34,
  markSize = 17,
  tone = "default",
}: {
  name: string;
  type?: ClassType | null;
  size?: number;
  markSize?: number;
  tone?: ClassIconTone;
}) {
  const primarySrc = getClassIconPath(name);
  const [stage, setStage] = useState<Stage>(
    primarySrc === DEFAULT_CLASS_ICON ? "default" : "primary",
  );
  // If the mark art is missing, drop the whole badge rather than leaving an
  // empty ring — the design rule is "no mark, no stand-in". This also means a
  // newly added mark file starts showing up with no code change.
  const [markFailed, setMarkFailed] = useState(false);

  const mark = type ? getClassMark(name, type) : null;
  const showMark = mark !== null && !markFailed;

  return (
    <span
      className={`${styles.tile} ${TONE_CLASS[tone]}`}
      style={
        {
          "--icon-size": `${size}px`,
          "--mark-size": `${Math.min(markSize, MAX_MARK_SIZE)}px`,
          "--mark-border": showMark ? mark.borderColor : "transparent",
        } as React.CSSProperties
      }
    >
      {stage === "placeholder" ? (
        <span className={styles.placeholder} role="img" aria-label={name} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- the runtime fallback chain (class icon -> default -> gray box) needs a plain onError handler; these are small static icons that don't need next/image's optimizer.
        <img
          src={stage === "primary" ? primarySrc : DEFAULT_CLASS_ICON}
          alt={name}
          className={styles.icon}
          onError={() =>
            setStage((current) => (current === "primary" ? "default" : "placeholder"))
          }
        />
      )}

      {showMark && (
        <span className={styles.mark}>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny pixel-art badge; next/image would resample it and defeat image-rendering:pixelated. */}
          <img
            src={mark.src}
            alt={mark.alt}
            className={styles.markImg}
            onError={() => setMarkFailed(true)}
          />
        </span>
      )}
    </span>
  );
}
