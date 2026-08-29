import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { ClassIcon } from "@/components/ClassIcon";
import { SiteHeader } from "@/components/SiteHeader";
import { ReferenceSection } from "./ReferenceSection";
// getVotesForUser is still exported for when "내 표" comes back.
import { getNextWaitingSurvey, getOpenSurvey, getSurveysInRange, getUserCharacterClass } from "@/lib/queries";
import { getVotingClosesAt } from "@/lib/format";
import { buildWeekSlots, getKstWeekRange } from "@/lib/week";
import { HeroCountdown } from "./HeroCountdown";
// VOTING_TYPE_LABEL is needed again once the "내 표" blocks are restored.
import { CLASS_TYPE_LABEL } from "@/lib/types";
import styles from "./page.module.css";

// Survey state and the user's own votes are live data, so this page must
// never be statically cached.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.dbUserId) {
    return (
      <main className={styles.loginMain}>
        <section className={styles.loginHero}>
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

  const [weekSurveys, classInfo, openSurvey, nextWaiting] = await Promise.all([
    getSurveysInRange(from, to),
    getUserCharacterClass(userId),
    getOpenSurvey(now),
    getNextWaitingSurvey(),
  ]);

  // 히어로 카운트다운이 세는 시간: 투표 열려 있음 → 마감까지 / 없음 → 다음 투표 노출까지
  const closesAt = openSurvey ? getVotingClosesAt(openSurvey.executed_at) : null;
  const closesAtMs = closesAt && closesAt > now ? closesAt.getTime() : null;
  const nextOpenMs = nextWaiting ? new Date(nextWaiting.exposed_at).getTime() : null;

  // "내 표" display is parked for now — the week grid shows survey state only.
  // Restore this (and the two commented blocks below) to bring it back.
  // const votes = await getVotesForUser(
  //   weekSurveys.map((s) => s.id),
  //   userId,
  // );

  const slots = buildWeekSlots(now, weekSurveys);
  // const todayVote = todaySurvey ? votes.get(todaySurvey.id) : undefined;

  return (
    <main className={styles.main}>
      <SiteHeader active="home" />

      <section className={styles.hero}>
        <Image
          src="/Wallpaper.jpg"
          alt=""
          fill
          priority
          // The hero never renders wider than the 1120px page column, so
          // telling next/image that keeps it from serving 1920px+ variants.
          sizes="(max-width: 1120px) 100vw, 1120px"
          className={styles.heroImage}
        />
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <div>
            {closesAtMs ? (
              <HeroCountdown label="투표 마감까지" targetMs={closesAtMs} />
            ) : nextOpenMs ? (
              <HeroCountdown label="다음 투표까지" targetMs={nextOpenMs} />
            ) : (
              <span className={styles.heroKicker}>설문 등록 대기중</span>
            )}
            <div className={styles.heroActions}>
              {closesAtMs ? (
                <Link href="/vote" className={styles.heroButton}>
                  투표하러 가기 <span className={styles.heroArrow}>→</span>
                </Link>
              ) : (
                <Link href="/vote" className={styles.heroButtonGhost}>
                  투표 페이지 <span className={styles.heroArrow}>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <div className={styles.columns}>
          <section>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>이번 주 거점전</h3>
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
              <Link href="/classes" className={styles.sectionLink}>
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

        <ReferenceSection />
      </div>
    </main>
  );
}
