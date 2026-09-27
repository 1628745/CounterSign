import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** recent_unverified_change +25: payee equals an unverified vendor_detail_changes.new_address from the last 30 days. */
export function recentUnverifiedChange(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement recentUnverifiedChange — see SPEC.md section 8");
}
