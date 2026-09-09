import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SiteShell } from "@/components/SiteShell";
import styles from "./profile.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 정보 | 아시바당" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const nickname = session.user.nickname ?? session.user.name ?? "연맹원";

  return (
    <SiteShell active="profile" kicker="MY PAGE" mainClassName={styles.main}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MY PAGE</p>
        <h1>내 정보</h1>
      </header>
      <section className={styles.profile} aria-label="내 프로필">
        <div className={styles.identity}>
          <ProfileAvatar image={session.user.image ?? null} name={nickname} size={72} />
          <div className={styles.nameBlock}>
            <p className={styles.caption}>Discord 프로필</p>
            <h2>{nickname}</h2>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
