import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./about.module.css";

export const metadata = { title: "연맹 소개 · 아시바당" };

/**
 * Layout is final; every piece of copy, photo and person is still TBD. The
 * design handoff asks for the placeholders to ship as-is so the content can
 * drop straight in later without touching the layout.
 */
const GUILD_INFO_ROWS = ["창단", "서버", "소속 길드", "거점전 요일", "지원 문의"];

const STAFF_SLOTS = ["staff-1", "staff-2", "staff-3"];

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <SiteHeader active="about" />

      <section className={styles.hero}>
        {/* Above the fold, so preload it — lazy loading flashes the dark band first. */}
        <Image src="/Wallpaper.jpg" alt="" fill priority sizes="(max-width: 1120px) 100vw, 1120px" className={styles.heroImage} />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <span className={styles.heroKicker}>ABOUT</span>
          <h1 className={styles.heroTitle}>연맹 소개</h1>
          <p className={styles.heroSub}>헤드라인 TBD</p>
        </div>
      </section>

      <div className={styles.body}>
        <div className={styles.columns}>
          <div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>소개 본문</h2>
              <span className={styles.tbdBadge}>TBD</span>
            </div>
            <div className={styles.introBox}>
              <p className={styles.introLead}>연맹 소개 문단 — 내용 미정</p>
              <p className={styles.introNote}>
                창단 배경, 활동 방식, 지원 조건 등. 2단 정렬 지면으로 조판할 예정입니다.
              </p>
            </div>

            <div className={`${styles.sectionHeader} ${styles.sectionHeaderSpaced}`}>
              <h2 className={styles.sectionTitle}>사진</h2>
              <span className={styles.tbdBadge}>TBD</span>
            </div>
            <div className={styles.plateGrid}>
              <div className={styles.plate}>
                <div className={styles.placeholder}>사진 1 — TBD</div>
              </div>
              <div className={styles.plate}>
                <div className={styles.placeholder}>사진 2 — TBD</div>
              </div>
            </div>

            <div className={`${styles.sectionHeader} ${styles.sectionHeaderSpaced}`}>
              <h2 className={styles.sectionTitle}>운영진</h2>
              <span className={styles.tbdBadge}>TBD</span>
            </div>
            <div className={styles.staffGrid}>
              {STAFF_SLOTS.map((key) => (
                <div key={key} className={styles.staffCard}>
                  <div className={`${styles.placeholder} ${styles.staffPortrait}`}>인물 TBD</div>
                  <div className={styles.staffName}>닉네임 TBD</div>
                  <span className={styles.staffRole}>역할 TBD</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>연맹 정보</h2>
              <span className={styles.tbdBadge}>TBD</span>
            </div>
            <dl className={styles.infoList}>
              {GUILD_INFO_ROWS.map((label) => (
                <div key={label} className={styles.infoRow}>
                  <dt className={styles.infoLabel}>{label}</dt>
                  <dd className={styles.infoValue}>TBD</dd>
                </div>
              ))}
            </dl>
            <button type="button" className={styles.discordButton} disabled>
              디스코드 참여 — TBD
            </button>
            <p className={styles.sideNote}>
              문구와 링크가 정해지면 이 자리에 그대로 채워 넣습니다. 레이아웃은 변경하지 않습니다.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
