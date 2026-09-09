import { auth, signOut } from "@/auth";
import { SiteNavigation } from "./SiteNavigation";

export type NavKey = "home" | "vote" | "classes" | "equipment" | "about" | "docs" | "admin" | "profile";

interface NavItem {
  key: NavKey;
  label: string;
  href: string | null;
}

// Add a menu entry here and every page picks it up. A null href renders as a
// muted, non-interactive "준비 중" item.
//
// 투표 is in the nav even though the handoff's header omits it: that design
// assumed the hero's "투표하러 가기" button was the way in, but the button only
// renders when a survey is scheduled for today. On a Saturday, or before the
// week's surveys are registered, that left no route to /vote at all.
const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "홈", href: "/" },
  { key: "vote", label: "투표", href: "/vote" },
  { key: "classes", label: "직업 등록", href: "/classes" },
  { key: "equipment", label: "스펙조사(준비중)", href: "/equipment" },
  { key: "about", label: "연맹 소개", href: "/about" },
  { key: "docs", label: "문서", href: "/docs" },
];

const ADMIN_NAV_ITEM: NavItem[] = [{ key: "admin", label: "관리자", href: "/admin" }];

export async function SiteHeader({ active, kicker = "" }: { active: NavKey; kicker?: string }) {
  // 관리자 항목은 디스코드 부대장·대장에게만 보인다. 화면에서 숨기는 것과 별개로
  // /admin 페이지와 서버 액션이 각각 다시 확인한다.
  const session = await auth();
  const isAdmin = session?.user?.isAdmin === true;
  return (
    <SiteNavigation
      active={active}
      kicker={kicker}
      items={[...NAV_ITEMS, ...(isAdmin ? ADMIN_NAV_ITEM : [])]}
      nickname={session?.user?.nickname ?? session?.user?.name ?? null}
      avatar={session?.user?.image ?? null}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    />
  );
}
