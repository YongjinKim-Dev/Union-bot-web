import { NextResponse } from "next/server";
import { auth } from "@/auth";

// / is intentionally NOT gated here: the homepage renders its own
// login-prompt hero when signed out (see src/app/page.tsx) instead of being
// redirect-gated, so people can land on it without bouncing through /login.
// Every other page is members-only (their header carries a 로그아웃 button, so
// they assume a session). Discord links point straight at /vote.
export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/vote/:path*", "/classes/:path*", "/about/:path*", "/docs/:path*"],
};
