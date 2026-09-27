/**
 * Reads/writes against the payments hypertable (SPEC.md section 5).
 * TODO(tiger data prompt): implement, including the duplicate_invoice and
 * new_payee/amount_anomaly lookups used by countersign/signals/*.
 */
export async function lookupPaymentHistory(vendorId: string): Promise<unknown[]> {
  void vendorId;
  throw new Error("TODO: implement lookupPaymentHistory — see SPEC.md section 5");
}

export async function insertPayment(payment: Record<string, unknown>): Promise<string> {
  void payment;
  throw new Error("TODO: implement insertPayment — see SPEC.md section 5");
}
