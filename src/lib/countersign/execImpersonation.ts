/** The owner's identity, per SPEC.md section 2. */
export const OWNER_NAME = "Dana Whitfield";
export const OWNER_DOMAIN = "tidewaterroasting.com";

export interface ExecImpersonationResult {
  fired: boolean;
  claimedName: string | null;
  senderDomain: string;
}

/**
 * exec_impersonation: the sender's display name claims the owner but the
 * domain isn't tidewaterroasting.com (SPEC.md section 8).
 */
export function checkExecImpersonation(fromName: string, fromAddress: string): ExecImpersonationResult {
  const senderDomain = (fromAddress.split("@")[1] ?? "").toLowerCase();
  const claimsOwner = fromName.toLowerCase().includes(OWNER_NAME.toLowerCase());
  const fired = claimsOwner && senderDomain !== OWNER_DOMAIN;
  return { fired, claimedName: claimsOwner ? fromName : null, senderDomain };
}
