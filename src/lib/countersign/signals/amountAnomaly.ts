import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** amount_anomaly +20: amount > 3x the vendor's 90-day median (Tiger Data). */
export function amountAnomaly(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement amountAnomaly — see SPEC.md section 8");
}
