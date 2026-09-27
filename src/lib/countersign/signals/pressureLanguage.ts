import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** pressure_language +5: urgency or secrecy cues (regex list). */
export function pressureLanguage(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement pressureLanguage — see SPEC.md section 8");
}
