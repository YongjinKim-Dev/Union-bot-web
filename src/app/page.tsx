import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { ClassIcon } from "@/components/ClassIcon";
// getVotesForUser is still exported for when "내 표" comes back.
import { getSurveysInRange, getUserCharacterClass } from "@/lib/queries";
import { formatSurveyTime, getVotingClosesAt } from "@/lib/format";
import { buildWeekSlots, formatShortDate, getKstWeekRange, isSameKstDay } from "@/lib/week";
// VOTING_TYPE_LABEL is needed again once the "내 표" blocks are restored.
import { CLASS_TYPE_LABEL } from "@/lib/types";
import styles from "./page.module.css";

// Survey state and the user's own votes are live data, so this page must
// never be statically cached.
export const dynamic = "force-dynamic";

interface NavItem {
  key: string;
  label: string;
  href: string | null;
}

// Menu entries live here so later phases only need to fill in an href.
// A null href renders as a muted, non-interactive "준비 중" item.
const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "홈", href: "/" },
  { key: "classes", label: "직업 등록", href: null },
  { key: "about", label: "연맹 소개", href: null },
  { key: "docs", label: "문서", href: null },
];

const REFERENCE_CARDS = [
  {
    key: "gb",
    kicker: "REFERENCE 01",
    title: "공방합 구간 정보",
    description:
      "표기 공격력 395–450 구간의 보너스 공격력·몬스터 추가 공격력, 표기 방어력 481–531 구간의 보너스 피해 감소.",
  },
  {
    key: "ec",
    kicker: "REFERENCE 02",
    title: "에크레타 악세사리",
    description: "반지·귀걸이·목걸이·허리띠의 단계별 수치와 강화 확률·기준 스택·필요 크론석.",
  },
];

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    return (
      <main className={styles.loginMain}>
        <section className={styles.loginHero}>
          <span className={styles.kicker}>UNION LEDGER</span>
          <h1 className={styles.loginBrand}>아시바당</h1>
          <p className={styles.loginTagline}>거점전 투표와 연맹 정보를 한 곳에서.</p>
          <Link href="/login?callbackUrl=%2F" className={styles.loginButton}>
            Discord로 로그인
          </Link>
        </section>
      </main>
    );
  }

  const userId = session.user.dbUserId;
  const now = new Date();
  const { from, to } = getKstWeekRange(now);

  const [weekSurveys, classInfo] = await Promise.all([
    getSurveysInRange(from, to),
    getUserCharacterClass(userId),
  ]);

  // "내 표" display is parked for now — the week grid shows survey state only.
  // Restore this (and the two commented blocks below) to bring it back.
  // const votes = await getVotesForUser(
  //   weekSurveys.map((s) => s.id),
  //   userId,
  // );

  const slots = buildWeekSlots(now, weekSurveys);
  const todaySurvey = weekSurveys.find((s) => isSameKstDay(s.executed_at, now)) ?? null;
  // const todayVote = todaySurvey ? votes.get(todaySurvey.id) : undefined;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brand}>아시바당</span>
          <span className={styles.kicker}>UNION LEDGER</span>
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
                className={`${styles.navLink} ${item.key === "home" ? styles.navLinkActive : ""}`}
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

      <section className={styles.hero}>
        <Image
          src="/Wallpaper.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <div>
            <span className={styles.heroKicker}>
              {todaySurvey
                ? `마감 ${formatSurveyTime(getVotingClosesAt(todaySurvey.executed_at))}`
                : "설문 등록 대기중"}
            </span>
            <h1 className={styles.heroTitle}>{formatShortDate(now)}</h1>
            {todaySurvey && (
              <div className={styles.heroActions}>
                {todaySurvey.status === "process" ? (
                  <Link href="/vote" className={styles.heroButton}>
                    투표하러 가기
                  </Link>
                ) : (
                  <Link href="/vote" className={styles.heroButtonGhost}>
                    {todaySurvey.status === "complete" ? "마감된 설문 보기" : "설문 대기중"}
                  </Link>
                )}
                {/* <span className={styles.heroMyVote}>
                  내 표 · {todayVote ? VOTING_TYPE_LABEL[todayVote.votingType] : "미등록"}
                </span> */}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <div className={styles.columns}>
          <section>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>이번 주 거점전</h3>
              <span className={styles.sectionMeta}>월 · 화 · 수 · 목 · 금 · 일</span>
            </div>
            <div className={styles.dayGrid}>
              {slots.map((slot) => {
                // const vote = slot.survey ? votes.get(slot.survey.id) : undefined;
                const isLive = slot.state === "진행";
                return (
                  <div
                    key={slot.weekday}
                    className={`${styles.dayCard} ${isLive ? styles.dayCardLive : ""}`}
                  >
                    <div className={styles.dayCardTop}>
                      <span className={`${styles.dayLabel} ${isLive ? styles.dayLabelLive : ""}`}>
                        {slot.label}
                      </span>
                      <span className={styles.dayDate}>{slot.date}</span>
                    </div>
                    <span
                      className={`${styles.dayState} ${isLive ? styles.dayStateLive : ""}`}
                    >
                      {slot.state}
                    </span>
                    {/* <span
                      className={`${styles.dayVote} ${vote ? styles.dayVoteSet : ""}`}
                    >
                      내 표 · {vote ? VOTING_TYPE_LABEL[vote.votingType] : "미등록"}
                    </span> */}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>내 등록 직업</h3>
              <Link href="/vote" className={styles.sectionLink}>
                변경
              </Link>
            </div>
            {classInfo ? (
              <div className={styles.classCard}>
                <ClassIcon name={classInfo.name} type={classInfo.type} size={30} tone="selected" />
                <div>
                  <div className={styles.className}>{classInfo.name}</div>
                  <span className={styles.classSub}>{CLASS_TYPE_LABEL[classInfo.type]}</span>
                </div>
              </div>
            ) : (
              <div className={styles.classCardEmpty}>
                <div className={styles.className}>직업 미등록</div>
                <span className={styles.classSub}>
                  참여·부속으로 투표하려면 직업을 등록해야 합니다.
                </span>
              </div>
            )}
            <p className={styles.classNote}>
              가장 최근에 선택한 직업이 투표에 표기됩니다.
            </p>
          </section>
        </div>

        <div className={styles.sectionHeader} style={{ marginTop: "36.8px" }}>
          <h3 className={styles.sectionTitle}>참고 자료</h3>
          <span className={styles.sectionMeta}>준비 중</span>
        </div>
        <div className={styles.refGrid}>
          {REFERENCE_CARDS.map((card) => (
            <div key={card.key} className={styles.refCard}>
              <span className={styles.refKicker}>{card.kicker}</span>
              <span className={styles.refTitle}>{card.title}</span>
              <span className={styles.refDescription}>{card.description}</span>
              <span className={styles.refSoon}>준비 중</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
