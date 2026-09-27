import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** exec_impersonation +15: sender's display name claims the owner but the domain isn't tidewaterroasting.com. */
export function execImpersonation(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement execImpersonation — see SPEC.md section 8");
}
