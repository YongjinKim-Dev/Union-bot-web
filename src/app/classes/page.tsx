import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteShell } from "@/components/SiteShell";
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
    <SiteShell mainClassName={styles.main} active="classes" kicker="CLASS">

      <div className={styles.content}>
        <ClassRegistration
          initialType={classInfo?.type ?? null}
          initialName={classInfo?.name ?? null}
        />
      </div>
    </SiteShell>
  );
}
