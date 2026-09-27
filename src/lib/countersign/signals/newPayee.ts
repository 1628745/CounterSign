import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** new_payee +10: no successful payments to this address in history (Tiger Data). */
export function newPayee(intent: PaymentIntent, context: PolicyContext): Signal {
  const fired = !context.hasSuccessfulPaymentTo.result;
  return {
    key: "new_payee",
    label: "New payee",
    weight: 10,
    fired,
    evidence: {
      sentence: fired
        ? `No successful payment has ever been made to ${intent.payeeAddress.slice(0, 8)}… before.`
        : `${intent.payeeAddress.slice(0, 8)}… has received successful payments before.`,
      data: { payeeAddress: intent.payeeAddress },
    },
    query: context.hasSuccessfulPaymentTo.query,
    result: context.hasSuccessfulPaymentTo.result,
  };
}
