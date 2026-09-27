import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Single shared Auth0Client instance (Universal Login), per the
 * @auth0/nextjs-auth0 v4 README. Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID,
 * AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL from the environment.
 * Mounts /auth/login, /auth/callback, /auth/logout, /auth/profile via
 * src/proxy.ts. See SPEC.md section 9 and docs/PROGRESS.md.
 */
export const auth0 = new Auth0Client();
