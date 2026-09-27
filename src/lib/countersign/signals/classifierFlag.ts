import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** classifier_flag +10: quarantined LLM (see ../classifier.ts) rates fraud likelihood >= 0.7, cached per email. */
export function classifierFlag(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement classifierFlag — see SPEC.md section 8");
}
