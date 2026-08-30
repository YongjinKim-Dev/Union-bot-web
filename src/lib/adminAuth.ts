import { auth } from "@/auth";

/* 서버 액션은 URL 만 알면 직접 호출될 수 있으므로 매번 역할을 확인한다. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.dbUserId) throw new Error("로그인이 필요합니다.");
  if (!session.user.isAdmin) throw new Error("권한이 없습니다.");
  return session.user;
}
