import { redirect } from "next/navigation";
import { auth0 } from "./client";

/**
 * Session helpers around @auth0/nextjs-auth0 v4. Every page and API route
 * needs a session except /api/health; CLI scripts use APPROVER_SUB instead
 * of a browser session (SPEC.md section 9). Routing is via src/proxy.ts,
 * which already redirects unauthenticated requests to /auth/login — these
 * helpers are for Server Components/Route Handlers that want the session
 * data itself (or a defensive re-check).
 */
export async function getSession() {
  return auth0.getSession();
}

export async function requireSession() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }
  return session;
}
