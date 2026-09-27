import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** new_payee +10: no successful payments to this address in history (Tiger Data). */
export function newPayee(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement newPayee — see SPEC.md section 8");
}
