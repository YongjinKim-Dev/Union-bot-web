import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { getOpenSpecSurvey, getSpecBuilds, getSpecSubmission } from "@/lib/specQueries";
import { EquipmentBuilder } from "./EquipmentBuilder";
import styles from "./equipment.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "스펙조사 | 아시바당" };

export default async function EquipmentPage() {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) redirect("/login?callbackUrl=%2Fequipment");

  const [saved, survey] = await Promise.all([getSpecBuilds(userId), getOpenSpecSurvey()]);
  const submission = survey ? await getSpecSubmission(survey.id, userId) : null;

  return (
    <main className={styles.main}>
      <SiteHeader active="equipment" kicker="EQUIPMENT" />
      <EquipmentBuilder
        key={userId}
        savedBuilds={saved.builds}
        brokenBuilds={saved.broken}
        surveyTitle={survey?.title ?? null}
        submission={submission}
      />
    </main>
  );
}
