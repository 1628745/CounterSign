import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0/client";

/**
 * Next.js 16 proxy (replaces middleware.ts — see docs/PROGRESS.md for why).
 * Every page and API route needs an Auth0 session except /api/health
 * (SPEC.md section 9), which is excluded entirely via the matcher below.
 */
export async function proxy(request: NextRequest) {
  // auth0.middleware handles the SDK's own /auth/login, /auth/callback,
  // /auth/logout, /auth/profile routes and rolls the session cookie.
  const authResponse = await auth0.middleware(request);

  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return authResponse;
  }

  const session = await auth0.getSession(request);
  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return authResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/health).*)"],
};
