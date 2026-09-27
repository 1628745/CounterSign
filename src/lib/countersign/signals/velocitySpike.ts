import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** velocity_spike +20: vendor's spend today including this payment > 2x their max daily spend over 90 days (vendor_spend_daily). */
export function velocitySpike(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement velocitySpike — see SPEC.md section 8");
}
