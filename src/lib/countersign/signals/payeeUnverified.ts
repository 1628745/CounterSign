import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** payee_unverified +40: payee is not the verified address of any vendor. */
export function payeeUnverified(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement payeeUnverified — see SPEC.md section 8");
}
