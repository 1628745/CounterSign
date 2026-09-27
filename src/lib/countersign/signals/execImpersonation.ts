import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** exec_impersonation +15: sender's display name claims the owner but the domain isn't tidewaterroasting.com. */
export function execImpersonation(intent: PaymentIntent, context: PolicyContext): Signal {
  const result = context.execImpersonation;
  return {
    key: "exec_impersonation",
    label: "Executive impersonation",
    weight: 15,
    fired: result.fired,
    evidence: {
      sentence: result.fired
        ? `The sender's display name claims to be ${result.claimedName}, but the email domain is "${result.senderDomain}", not tidewaterroasting.com.`
        : `The sender's display name does not claim to be the owner from an outside domain.`,
      data: { claimedName: result.claimedName, senderDomain: result.senderDomain },
    },
  };
}
