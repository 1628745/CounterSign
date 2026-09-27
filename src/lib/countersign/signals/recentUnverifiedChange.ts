import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** recent_unverified_change +25: payee equals an unverified vendor_detail_changes.new_address from the last 30 days. */
export function recentUnverifiedChange(intent: PaymentIntent, context: PolicyContext): Signal {
  const fired = context.recentUnverifiedChange.result;
  return {
    key: "recent_unverified_change",
    label: "Recent unverified address change",
    weight: 25,
    fired,
    evidence: {
      sentence: fired
        ? `This payee address matches an unverified vendor payout-address change recorded within the last 30 days.`
        : `No unverified vendor payout-address change in the last 30 days matches this payee.`,
      data: { payeeAddress: intent.payeeAddress },
    },
    query: context.recentUnverifiedChange.query,
    result: context.recentUnverifiedChange.result,
  };
}
