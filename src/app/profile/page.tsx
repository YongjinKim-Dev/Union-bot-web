import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClassIcon } from "@/components/ClassIcon";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SiteShell } from "@/components/SiteShell";
import { formatKstDateTime } from "@/lib/format";
import { getLatestProfileSubmission, getProfileMembership } from "@/lib/profileQueries";
import { CLASS_TYPE_LABEL } from "@/lib/types";
import styles from "./profile.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 정보 | 아시바당" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const nickname = session.user.nickname ?? session.user.name ?? "연맹원";
  const [membership, submission] = await Promise.all([
    getProfileMembership(session.user.dbUserId),
    getLatestProfileSubmission(session.user.dbUserId),
  ]);
  const characterClass = membership.characterClass;

  return (
    <SiteShell active="profile" kicker="MY PAGE" mainClassName={styles.main}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MY PAGE</p>
        <h1>내 정보</h1>
      </header>
      <div className={styles.sections}>
        <section className={styles.profile} aria-label="내 프로필">
          <div className={styles.identity}>
            <ProfileAvatar image={session.user.image ?? null} name={nickname} size={72} />
            <div className={styles.nameBlock}>
              <p className={styles.caption}>Discord 프로필</p>
              <h2>{nickname}</h2>
              <p className={styles.guild}><span>소속 길드</span> {membership.guildName ?? "소속 없음"}</p>
            </div>
          </div>
        </section>

        <section className={styles.profile} aria-labelledby="profile-class-heading">
          <div className={styles.sectionHeader}>
            <h2 id="profile-class-heading">등록 직업</h2>
            <Link href="/classes" className={styles.link}>직업 변경 <span aria-hidden="true">↗</span></Link>
          </div>
          {characterClass ? (
            <div className={styles.characterClass}>
              <ClassIcon name={characterClass.name} type={characterClass.type} size={56} markSize={20} />
              <div>
                <p className={styles.className}>{characterClass.name}</p>
                <p className={styles.classType}>{CLASS_TYPE_LABEL[characterClass.type]}</p>
              </div>
            </div>
          ) : <p className={styles.empty}>등록한 직업이 없습니다.</p>}
        </section>

        <section className={styles.profile} aria-labelledby="profile-spec-heading">
          <div className={styles.sectionHeader}>
            <h2 id="profile-spec-heading">최근 제출 스펙</h2>
            {submission && <span className={styles.badge}>{submission.isComplete ? "제출 완료" : "수치 미확정"}</span>}
          </div>
          {submission ? <>
            <p className={styles.surveyTitle}>{submission.surveyTitle ?? "조사 정보 없음"}</p>
            <dl className={styles.stats}>
              <div><dt>주무기 AP</dt><dd>{submission.isComplete ? submission.ap : "—"}</dd></div>
              <div><dt>각성 AAP</dt><dd>{submission.isComplete ? submission.aap : "—"}</dd></div>
              <div><dt>방어력 DP</dt><dd>{submission.isComplete ? submission.dp : "—"}</dd></div>
              <div className={styles.score}><dt>공방합</dt><dd>{submission.isComplete ? submission.score : "—"}</dd></div>
            </dl>
            <p className={styles.submittedAt}>제출일 <time dateTime={submission.submittedAt.toISOString()}>{formatKstDateTime(submission.submittedAt)}</time></p>
          </> : <p className={styles.empty}>아직 제출한 스펙이 없습니다.</p>}
          <Link href="/equipment" className={styles.link}>스펙조사로 이동 <span aria-hidden="true">↗</span></Link>
        </section>
      </div>
    </SiteShell>
  );
}
