import type { PaymentIntent, PolicyContext, Signal } from "../types";

/**
 * Hard block: same vendor + invoice number already paid, or same vendor +
 * same amount within 14 days.
 */
export function duplicateInvoice(intent: PaymentIntent, context: PolicyContext): Signal {
  void intent;
  void context;
  throw new Error("TODO: implement duplicateInvoice — see SPEC.md section 8");
}
