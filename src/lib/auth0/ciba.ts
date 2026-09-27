export type CibaStatus = "pending" | "approved" | "denied" | "expired";

export interface CibaInitiateResult {
  authReqId: string;
  expiresIn: number;
  interval: number;
}

/**
 * POST https://{AUTH0_DOMAIN}/bc-authorize — starts a CIBA push approval.
 * binding_message must be sanitized to [A-Za-z0-9 +\-_.,:#] and truncated
 * to 64 chars. login_hint is {"format":"iss_sub","iss":"https://{AUTH0_DOMAIN}/","sub":approverSub}.
 * See SPEC.md section 9.
 *
 * TODO(auth0 prompt): implement.
 */
export async function initiate(bindingMessage: string, approverSub: string): Promise<CibaInitiateResult> {
  void bindingMessage;
  void approverSub;
  throw new Error("TODO: implement ciba.initiate — see SPEC.md section 9");
}

/**
 * POST /oauth/token with grant_type urn:openid:params:grant-type:ciba.
 * Maps authorization_pending/slow_down -> "pending" (with backoff, floor 6s),
 * access_denied -> "denied", expired_token -> "expired". On success, verifies
 * the access token against the tenant JWKS with jose before returning "approved".
 *
 * TODO(auth0 prompt): implement.
 */
export async function poll(authReqId: string): Promise<CibaStatus> {
  void authReqId;
  throw new Error("TODO: implement ciba.poll — see SPEC.md section 9");
}

/**
 * Sanitizes a binding_message: only letters, digits, spaces, and + - _ . , : #,
 * max 64 chars (SPEC.md section 9).
 *
 * TODO(auth0 prompt): implement.
 */
export function sanitizeBindingMessage(message: string): string {
  void message;
  throw new Error("TODO: implement sanitizeBindingMessage — see SPEC.md section 9");
}
