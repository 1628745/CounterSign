import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** hidden_text +25: the source email contains hidden text (see ../hiddenText.ts for detection). */
export function hiddenTextSignal(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement hiddenTextSignal — see SPEC.md section 8");
}
