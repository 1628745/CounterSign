import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** lookalike_sender +30: the email where the payee address first appears came from a lookalike domain (see ../lookalike.ts). */
export function lookalikeSender(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement lookalikeSender — see SPEC.md section 8");
}
