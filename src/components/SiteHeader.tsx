import Link from "next/link";
import { signOut } from "@/auth";
import styles from "./SiteHeader.module.css";

export type NavKey = "home" | "vote" | "classes" | "about" | "docs";

interface NavItem {
  key: NavKey;
  label: string;
  href: string | null;
}

// Add a menu entry here and every page picks it up. A null href renders as a
// muted, non-interactive "준비 중" item.
//
// 투표 is in the nav even though the handoff's header omits it: that design
// assumed the hero's "투표하러 가기" button was the way in, but the button only
// renders when a survey is scheduled for today. On a Saturday, or before the
// week's surveys are registered, that left no route to /vote at all.
const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "홈", href: "/" },
  { key: "vote", label: "투표", href: "/vote" },
  { key: "classes", label: "직업 등록", href: "/classes" },
  { key: "about", label: "연맹 소개", href: "/about" },
  { key: "docs", label: "문서", href: "/docs" },
];

export function SiteHeader({ active, kicker = "UNION LEDGER" }: { active: NavKey; kicker?: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.brandBlock}>
        <span className={styles.brand}>아시바당</span>
        <span className={styles.kicker}>{kicker}</span>
      </div>
      <form
        className={styles.logoutForm}
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className={styles.logoutButton}>
          로그아웃
        </button>
      </form>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) =>
          item.href ? (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.navLink} ${item.key === active ? styles.navLinkActive : ""}`}
            >
              {item.label}
            </Link>
          ) : (
            <span key={item.key} className={styles.navLinkSoon} title="준비 중">
              {item.label}
            </span>
          ),
        )}
      </nav>
    </header>
  );
}
