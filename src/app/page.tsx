import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getSurveysByStatus, getVoteCounts } from "@/lib/queries";
import type { VotingType } from "@/lib/types";
import styles from "./page.module.css";

// The active-survey preview on the 투표 card needs a live count, so this
// page must never be statically cached.
export const dynamic = "force-dynamic";

interface NavItem {
  key: string;
  label: string;
  description: string;
  href: string | null;
}

// Add new menu entries here — anything without an href renders as a
// dashed "준비 중" card automatically.
const NAV_ITEMS: NavItem[] = [
  {
    key: "vote",
    label: "투표",
    description: "거점전 참여 여부를 투표하세요.",
    href: "/vote",
  },
  {
    key: "wiki",
    label: "위키",
    description: "연맹 정보와 공략 자료.",
    href: null,
  },
  {
    key: "roster",
    label: "연맹원 명단",
    description: "소속 길드원 목록.",
    href: null,
  },
];

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    return (
      <main className={styles.main}>
        <section className={styles.loginHero}>
          <h1 className={styles.brand}>아시바당</h1>
          <p className={styles.tagline}>거점전 투표와 연맹 정보를 한 곳에서.</p>
          <Link href="/login?callbackUrl=%2F" className={styles.loginButton}>
            Discord로 로그인
          </Link>
        </section>
      </main>
    );
  }

  const [activeSurvey] = await getSurveysByStatus(["process"]);
  const voteCounts = activeSurvey ? await getVoteCounts(activeSurvey.id) : null;
  const totalVotes = voteCounts
    ? (Object.keys(voteCounts) as VotingType[]).reduce((sum, type) => sum + voteCounts[type], 0)
    : 0;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <span className={styles.logo}>⚔️</span>
          <span className={styles.brand}>아시바당</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.nickname}>{session.user.nickname}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className={styles.logoutButton}>
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>아시바당</h1>
        <p className={styles.heroSubtitle}>거점전 투표와 연맹 정보를 한 곳에서 확인하세요.</p>
      </section>

      <section className={styles.grid}>
        {NAV_ITEMS.map((item) =>
          item.href ? (
            <Link key={item.key} href={item.href} className={`${styles.card} ${styles.cardActive}`}>
              <h2 className={styles.cardTitle}>{item.label}</h2>
              <p className={styles.cardDescription}>{item.description}</p>
              <p className={styles.cardMeta}>
                {activeSurvey ? `진행중 · 참여 ${totalVotes}명` : "진행중인 설문 없음"}
              </p>
            </Link>
          ) : (
            <div key={item.key} className={styles.cardSoon}>
              <h2 className={styles.cardTitle}>{item.label}</h2>
              <p className={styles.cardDescription}>{item.description}</p>
              <span className={styles.soonBadge}>준비 중</span>
            </div>
          ),
        )}
      </section>
    </main>
  );
}
