import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { EquipmentBuilder } from "./EquipmentBuilder";
import styles from "./equipment.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "스펙조사 | 아시바당" };

export default async function EquipmentPage() {
  const session = await auth();
  if (!session?.user?.dbUserId) redirect("/login?callbackUrl=%2Fequipment");
  return (
    <main className={styles.main}>
      <SiteHeader active="equipment" kicker="EQUIPMENT" />
      <EquipmentBuilder key={session.user.dbUserId} />
    </main>
  );
}
