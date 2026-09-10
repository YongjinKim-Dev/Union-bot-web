import type { ReactNode } from "react";
import { SiteHeader, type NavKey } from "./SiteHeader";
import styles from "./SiteShell.module.css";

export function SiteShell({ active, kicker, mainClassName = "", children }: {
  active: NavKey;
  kicker?: string;
  mainClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">본문으로 건너뛰기</a>
      <SiteHeader active={active} kicker={kicker} />
      <main id="main-content" tabIndex={-1} className={`${mainClassName} ${styles.content}`}>
        {children}
      </main>
    </div>
  );
}
