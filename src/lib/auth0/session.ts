/**
 * Session helpers around @auth0/nextjs-auth0 v4. Every page and API route
 * needs a session except /api/health; CLI scripts use APPROVER_SUB instead
 * of a browser session (SPEC.md section 9).
 *
 * TODO(auth0 prompt): implement using the Auth0Client from
 * @auth0/nextjs-auth0/server. Record in docs/PROGRESS.md whether routing
 * goes through middleware.ts or proxy.ts.
 */
export async function requireSession(): Promise<{ sub: string }> {
  throw new Error("TODO: implement requireSession — see SPEC.md section 9");
}
