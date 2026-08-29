import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserCharacterClass } from "@/lib/queries";
import { ClassRegistration } from "./ClassRegistration";
import styles from "./classes.module.css";

// Reflects the user's currently registered class, so never cache it.
export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user?.dbUserId) {
    redirect("/login?callbackUrl=%2Fclasses");
  }

  const classInfo = await getUserCharacterClass(session.user.dbUserId);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brand}>아시바당</span>
          <span className={styles.headerKicker}>직업 등록</span>
        </div>
        <Link href="/" className={styles.homeLink}>
          ← 홈으로
        </Link>
      </header>

      <ClassRegistration
        initialType={classInfo?.type ?? null}
        initialName={classInfo?.name ?? null}
      />
    </main>
  );
}
