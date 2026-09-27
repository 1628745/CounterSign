import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** Hard block: the payee address appears only inside hidden text (see ../hiddenText.ts). */
export function hiddenOnlyPayee(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement hiddenOnlyPayee — see SPEC.md section 8");
}
