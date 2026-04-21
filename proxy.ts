import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

/**
 * Public path prefixes that bypass authentication checks.
 * Everything else is treated as a protected route.
 */
const PUBLIC_PREFIXES = [
  "/auth",      // login, 2fa, reset-password
  "/api/auth",  // Better Auth handler at app/api/auth/[...all]/route.ts
];

/**
 * Next.js middleware that enforces server-side authentication on all app routes.
 * Resolves the session from the HTTP-only JWT cookie set by the nextCookies() plugin.
 * Unauthenticated requests are redirected to /auth/login before any page renders.
 *
 * The (main)/layout.tsx client-side guard is preserved as a secondary UX layer
 * (loading state, client navigation) — this middleware is the first line of defence.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public paths through without a session check
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Resolve session from JWT cookie — no DB round-trip due to strategy: "jwt" + refreshCache
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Run middleware on all routes except Next.js internals and static assets.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
