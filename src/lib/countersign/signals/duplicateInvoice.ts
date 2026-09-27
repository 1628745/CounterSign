import type { PaymentIntent, PolicyContext, Signal } from "../types";

/**
 * Hard block: same vendor + invoice number already paid, or same vendor +
 * same amount within 14 days. weight is 0 — hard blocks short-circuit the
 * decision instead of contributing to the score (SPEC.md section 8).
 */
export function duplicateInvoice(intent: PaymentIntent, context: PolicyContext): Signal {
  const { duplicateInvoiceNumber, duplicateAmountWithin14Days } = context.duplicateInvoice.result;
  const fired = duplicateInvoiceNumber || duplicateAmountWithin14Days;

  let sentence: string;
  if (duplicateInvoiceNumber) {
    sentence = `Invoice ${intent.invoiceNumber ?? "(none)"} for this vendor has already been paid.`;
  } else if (duplicateAmountWithin14Days) {
    sentence = `This vendor was already paid this exact amount within the last 14 days.`;
  } else {
    sentence = `No matching invoice number or amount was paid to this vendor recently.`;
  }

  return {
    key: "duplicate_invoice",
    label: "Duplicate invoice",
    weight: 0,
    fired,
    evidence: { sentence, data: { duplicateInvoiceNumber, duplicateAmountWithin14Days } },
    query: context.duplicateInvoice.query,
    result: context.duplicateInvoice.result,
  };
}
