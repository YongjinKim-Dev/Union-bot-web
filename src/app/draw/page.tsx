import type { Metadata } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { DrawStage } from "./DrawStage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "추첨 | 아시바당" };

/* 다 같이 보는 화면이라 사이드바도 머리글도 없다. 사다리만 크게 나온다. */
export default async function DrawPage() {
  await requireAdmin();
  return <DrawStage />;
}
