"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NavKey } from "./SiteHeader";
import { ProfileAvatar } from "./ProfileAvatar";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

interface Props {
  active: NavKey;
  kicker: string;
  items: { key: NavKey; label: string; href: string | null }[];
  nickname: string | null;
  avatar: string | null;
  signOutAction: () => Promise<void>;
}

export function SiteNavigation({ active, kicker, items, nickname, avatar, signOutAction }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const close = () => dialog.current?.close();

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const onResize = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const brand = (
    <Link href="/" className={styles.brandLink} onClick={close}>
      <Image src="/brand-icon.png" alt="" width={28} height={28} className={styles.brandIcon} />
      <span className={styles.brand}>아시바당</span>
    </Link>
  );
  const menu = (
    <nav className={styles.nav} aria-label="주 메뉴">
      {items.map(item => item.href ? (
        <Link key={item.key} href={item.href} onClick={close}
          aria-current={item.key === active ? "page" : undefined}
          className={`${styles.navLink} ${item.key === active ? styles.navLinkActive : ""}`}>
          {item.label}
        </Link>
      ) : <span key={item.key} className={styles.navLinkSoon} title="준비 중">{item.label}</span>)}
    </nav>
  );
  const footer = (
    <div className={styles.bottom}>
      {nickname && <Link href="/profile" onClick={close}
        aria-label={`${nickname} · 내 정보`}
        aria-current={active === "profile" ? "page" : undefined}
        className={`${styles.profileLink} ${active === "profile" ? styles.profileActive : ""}`}>
        <ProfileAvatar image={avatar} name={nickname} size={34} />
        <span className={styles.profileText}>
          <span className={styles.nickname}>{nickname}</span>
          <span className={styles.profileHint}>내 정보</span>
        </span>
        <svg className={styles.profileArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </Link>}
      <div className={styles.footer}>
        <ThemeToggle compact />
        <form action={signOutAction}><button type="submit" className={styles.logoutButton}>로그아웃</button></form>
      </div>
    </div>
  );
  return <>
    <aside className={styles.sidebar} aria-label="사이트 메뉴">
      <div>{brand}<span className={styles.edition}>UNION LEDGER</span></div>
      {menu}
      {footer}
    </aside>
    <header className={styles.mobileHeader}>
      {brand}
      <span className={styles.context}>{kicker || "UNION LEDGER"}</span>
      <button ref={opener} type="button" className={styles.iconButton} aria-label="메뉴 열기"
        aria-expanded={open} aria-controls={dialogId} aria-haspopup="dialog"
        onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
    </header>
    {/* dialog로 바깥 화면을 비활성화하고, Tab이 브라우저 툴바로 빠지는 것도 막는다. */}
    <dialog ref={dialog} id={dialogId} className={styles.drawer} aria-label="사이트 메뉴"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0);
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClose={() => { setOpen(false); if (opener.current?.getClientRects().length) opener.current.focus(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      <div className={styles.drawerTop}>
        {brand}
        <button type="button" className={styles.iconButton} aria-label="메뉴 닫기" onClick={close}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      {menu}
      {footer}
    </dialog>
  </>;
}
