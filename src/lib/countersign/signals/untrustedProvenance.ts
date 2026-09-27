import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** untrusted_provenance +15: the payee address appears in email content rather than the vendor registry. */
export function untrustedProvenance(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement untrustedProvenance — see SPEC.md section 8");
}
