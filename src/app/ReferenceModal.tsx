"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./reference.module.css";

/**
 * Shell for the 참고 자료 modals. The prototype had neither overlay-click nor
 * Esc dismissal; the handoff asks for both to be added in implementation.
 */
export function ReferenceModal({
  kicker,
  title,
  width,
  headerExtra,
  onClose,
  children,
}: {
  kicker: string;
  title: string;
  width: number;
  headerExtra?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Keep the page behind from scrolling under the modal.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      // Only a click that starts and ends on the overlay itself dismisses —
      // otherwise a text selection dragged out of the panel would close it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.panel}
        style={{ maxWidth: `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.panelKicker}>{kicker}</span>
            <h2 className={styles.panelTitle}>{title}</h2>
          </div>
          <div className={styles.panelHeaderActions}>
            {headerExtra}
            <button ref={closeRef} type="button" className={styles.closeButton} onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
        <div className={styles.panelBody}>{children}</div>
      </div>
    </div>
  );
}
