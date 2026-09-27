import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** payee_unverified +40: payee is not the verified address of any vendor. */
export function payeeUnverified(intent: PaymentIntent, context: PolicyContext): Signal {
  const fired = !context.verifiedAddresses.includes(intent.payeeAddress);
  return {
    key: "payee_unverified",
    label: "Payee not verified",
    weight: 40,
    fired,
    evidence: {
      sentence: fired
        ? `${intent.payeeAddress.slice(0, 8)}… is not the verified payout address of any vendor on file.`
        : `${intent.payeeAddress.slice(0, 8)}… is a verified vendor payout address.`,
      data: { payeeAddress: intent.payeeAddress },
    },
  };
}
