import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** lookalike_sender +30: the email where the payee address first appears came from a lookalike domain (see ../lookalike.ts). */
export function lookalikeSender(intent: PaymentIntent, context: PolicyContext): Signal {
  const result = context.firstAppearanceLookalike;
  const fired = result?.isLookalike ?? false;
  return {
    key: "lookalike_sender",
    label: "Lookalike sender domain",
    weight: 30,
    fired,
    evidence: {
      sentence: fired
        ? `The email that first introduced this payee address came from a domain imitating ${result?.imitates} (${result?.technique}).`
        : `The email that first introduced this payee address did not come from a lookalike domain.`,
      data: { imitates: result?.imitates ?? null, technique: result?.technique ?? null },
    },
  };
}
