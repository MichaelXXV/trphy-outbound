import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_HOURS, freshExpiry, signSession, verifySession } from "@/lib/session";

// Open without a session: the root redirect, lead pages, the login, webhooks, and Next's own assets.
// Everything under /ops needs a valid session. The cookie is re-issued on every ops request so the
// 12 hour window slides with use.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/ops") || pathname === "/ops/login") return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/ops/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE, await signSession({ name: session.name, exp: freshExpiry() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return res;
}

export const config = {
  matcher: ["/ops/:path*"],
};
