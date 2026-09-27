import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** untrusted_provenance +15: the payee address appears in email content rather than the vendor registry. */
export function untrustedProvenance(intent: PaymentIntent, context: PolicyContext): Signal {
  const hasRegistryHit = context.provenance.hits.some((h) => h.source === "registry");
  const firstEmailHit = context.provenance.hits.find((h) => h.source === "email");
  const fired = !hasRegistryHit && firstEmailHit !== undefined;
  return {
    key: "untrusted_provenance",
    label: "Untrusted provenance",
    weight: 15,
    fired,
    evidence: {
      sentence: fired
        ? `This payout address comes from an email (${firstEmailHit?.emailId}), not from the verified vendor registry.`
        : `This payout address is recorded in the verified vendor registry.`,
      data: { hasRegistryHit, firstEmailHit: firstEmailHit?.emailId ?? null },
    },
  };
}
