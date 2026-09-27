import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type CibaStatus = "pending" | "approved" | "denied" | "expired";

export interface CibaInitiateResult {
  authReqId: string;
  expiresIn: number;
  interval: number;
}

export interface PollOutcome {
  status: CibaStatus;
  /** Only meaningful when status === "pending" after a slow_down response. */
  intervalS?: number;
  /** Only present when status === "approved". */
  claims?: JWTPayload;
}

interface TokenErrorBody {
  error?: string;
  error_description?: string;
  interval?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example (SPEC.md section 13)`);
  }
  return value;
}

/**
 * Sanitizes a CIBA binding_message: only letters, digits, spaces, and
 * + - _ . , : # ; max 64 characters (SPEC.md section 9).
 */
export function sanitizeBindingMessage(message: string): string {
  return message.replace(/[^A-Za-z0-9 +\-_.,:#]/g, "").slice(0, 64);
}

/** Parses a slow_down backoff hint like "... wait 10 seconds ..." out of an error_description. */
function parseSecondsFromDescription(description?: string): number | undefined {
  const match = description?.match(/(\d+)\s*second/i);
  return match ? Number(match[1]) : undefined;
}

/**
 * Pure mapper from a raw POST /oauth/token (grant_type
 * urn:openid:params:grant-type:ciba) response to a PollOutcome. No I/O —
 * kept separate from poll() so it's unit-testable (SPEC.md section 9/14).
 * Auth0 may report the slow_down backoff as a numeric `interval` field or
 * embedded in `error_description`; either way we floor at 6s.
 */
export function mapPollResponse(httpStatus: number, body: TokenErrorBody): Omit<PollOutcome, "claims"> {
  if (httpStatus === 200) {
    return { status: "approved" };
  }
  switch (body.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down": {
      const hinted = typeof body.interval === "number" ? body.interval : parseSecondsFromDescription(body.error_description);
      return { status: "pending", intervalS: Math.max(hinted ?? 6, 6) };
    }
    case "access_denied":
      return { status: "denied" };
    case "expired_token":
      return { status: "expired" };
    default:
      throw new Error(`Unexpected CIBA polling response (HTTP ${httpStatus}): ${body.error ?? "unknown error"} — ${body.error_description ?? ""}`);
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function getJwks(domain: string) {
  let jwks = jwksCache.get(domain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
    jwksCache.set(domain, jwks);
  }
  return jwks;
}

/**
 * Verifies a CIBA access token against the tenant JWKS: issuer, audience,
 * scope includes payments:approve, sub = the expected approver (SPEC.md
 * section 9).
 */
async function verifyAccessToken(accessToken: string, expectedSub?: string): Promise<JWTPayload> {
  const domain = requireEnv("AUTH0_DOMAIN");
  const audience = requireEnv("AUTH0_AUDIENCE");
  const { payload } = await jwtVerify(accessToken, getJwks(domain), {
    issuer: `https://${domain}/`,
    audience,
  });
  const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
  if (!scopes.includes("payments:approve")) {
    throw new Error("CIBA access token is missing the payments:approve scope");
  }
  if (expectedSub && payload.sub !== expectedSub) {
    throw new Error(`CIBA access token sub (${payload.sub}) does not match the expected approver (${expectedSub})`);
  }
  return payload;
}

/**
 * POST https://{AUTH0_DOMAIN}/bc-authorize — starts a CIBA push approval.
 * requested_expiry is kept at 300s or less: Auth0 only routes push
 * notifications (vs. email) at <=300s (SPEC.md section 9).
 */
export async function initiate(bindingMessage: string, approverSub: string): Promise<CibaInitiateResult> {
  const domain = requireEnv("AUTH0_DOMAIN");
  const clientId = requireEnv("AUTH0_CLIENT_ID");
  const clientSecret = requireEnv("AUTH0_CLIENT_SECRET");
  const audience = requireEnv("AUTH0_AUDIENCE");

  const response = await fetch(`https://${domain}/bc-authorize`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid payments:approve",
      audience,
      binding_message: sanitizeBindingMessage(bindingMessage),
      requested_expiry: "300",
      login_hint: JSON.stringify({ format: "iss_sub", iss: `https://${domain}/`, sub: approverSub }),
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`bc-authorize failed (HTTP ${response.status}): ${body.error_description ?? body.error ?? JSON.stringify(body)}`);
  }
  return { authReqId: body.auth_req_id, expiresIn: body.expires_in, interval: body.interval };
}

/**
 * POST /oauth/token with grant_type urn:openid:params:grant-type:ciba.
 * Maps authorization_pending/slow_down -> "pending" (with backoff, floor
 * 6s), access_denied -> "denied", expired_token -> "expired". On success,
 * verifies the access token against the tenant JWKS before returning
 * "approved" (SPEC.md section 9).
 */
export async function poll(authReqId: string, expectedSub: string | undefined = process.env.APPROVER_SUB): Promise<PollOutcome> {
  const domain = requireEnv("AUTH0_DOMAIN");
  const clientId = requireEnv("AUTH0_CLIENT_ID");
  const clientSecret = requireEnv("AUTH0_CLIENT_SECRET");

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:openid:params:grant-type:ciba",
      client_id: clientId,
      client_secret: clientSecret,
      auth_req_id: authReqId,
    }),
  });
  const body = await response.json();
  const outcome = mapPollResponse(response.status, body);
  if (outcome.status !== "approved") {
    return outcome;
  }
  const claims = await verifyAccessToken(body.access_token, expectedSub);
  return { ...outcome, claims };
}
