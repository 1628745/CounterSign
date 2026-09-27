import { getDb } from "../client";

/**
 * Every Tiger-backed signal in src/lib/countersign/signals/*.ts calls one of
 * these. Each has a stable name and returns the exact SQL + params it ran,
 * so the "Under the Hood" UI can show the query and its result as evidence
 * (SPEC.md section 5/8).
 */
export interface PolicyQueryResult<T> {
  name: string;
  sql: string;
  params: unknown[];
  result: T;
}

/** A payment counts as "successful" if it's seeded history or actually confirmed on-chain. */
const SUCCESSFUL_PAYMENT_FILTER = "(mode = 'history' OR tx_status = 'confirmed')";

/** amount_anomaly: the vendor's 90-day median payment amount, in micros. */
export async function vendorMedian90d(vendorId: string): Promise<PolicyQueryResult<number | null>> {
  const sql = getDb();
  const text = `
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY amount_micros) AS median_micros
    FROM payments
    WHERE vendor_id = $1
      AND ts >= now() - INTERVAL '90 days'
      AND ${SUCCESSFUL_PAYMENT_FILTER}
  `;
  const rows = await sql.unsafe<{ median_micros: string | null }[]>(text, [vendorId]);
  const median = rows[0]?.median_micros != null ? Number(rows[0].median_micros) : null;
  return { name: "vendorMedian90d", sql: text, params: [vendorId], result: median };
}

/** velocity_spike: the vendor's highest single-day spend over the last 90 days, from vendor_spend_daily. */
export async function vendorMaxDaily90d(vendorId: string): Promise<PolicyQueryResult<number | null>> {
  const sql = getDb();
  const text = `
    SELECT max(total_micros) AS max_micros
    FROM vendor_spend_daily
    WHERE vendor_id = $1
      AND bucket >= now() - INTERVAL '90 days'
  `;
  const rows = await sql.unsafe<{ max_micros: string | null }[]>(text, [vendorId]);
  const max = rows[0]?.max_micros != null ? Number(rows[0].max_micros) : null;
  return { name: "vendorMaxDaily90d", sql: text, params: [vendorId], result: max };
}

/**
 * velocity_spike: the vendor's spend so far *today*, queried against the raw
 * payments hypertable rather than vendor_spend_daily — today's bucket is
 * deliberately excluded from that continuous aggregate's refresh window
 * (its end_offset is 1 day), so it would always read as stale/empty.
 */
export async function vendorSpendToday(vendorId: string): Promise<PolicyQueryResult<number>> {
  const sql = getDb();
  const text = `
    SELECT coalesce(sum(amount_micros), 0) AS total_micros
    FROM payments
    WHERE vendor_id = $1
      AND ts >= date_trunc('day', now())
      AND ${SUCCESSFUL_PAYMENT_FILTER}
  `;
  const rows = await sql.unsafe<{ total_micros: string }[]>(text, [vendorId]);
  const total = Number(rows[0]?.total_micros ?? 0);
  return { name: "vendorSpendToday", sql: text, params: [vendorId], result: total };
}

/** new_payee: whether this payee address has ever received a successful payment. */
export async function hasSuccessfulPaymentTo(payeeAddress: string): Promise<PolicyQueryResult<boolean>> {
  const sql = getDb();
  const text = `
    SELECT EXISTS (
      SELECT 1 FROM payments
      WHERE payee_address = $1
        AND ${SUCCESSFUL_PAYMENT_FILTER}
    ) AS exists
  `;
  const rows = await sql.unsafe<{ exists: boolean }[]>(text, [payeeAddress]);
  return { name: "hasSuccessfulPaymentTo", sql: text, params: [payeeAddress], result: rows[0]?.exists ?? false };
}

export interface DuplicateInvoiceResult {
  duplicateInvoiceNumber: boolean;
  duplicateAmountWithin14Days: boolean;
}

/**
 * Hard block duplicate_invoice: same vendor + invoice number already paid,
 * or same vendor + same amount within 14 days.
 */
export async function isDuplicateInvoice(
  vendorId: string,
  invoiceNumber: string | null,
  amountMicros: bigint,
): Promise<PolicyQueryResult<DuplicateInvoiceResult>> {
  const sql = getDb();
  const text = `
    SELECT
      EXISTS (
        SELECT 1 FROM payments
        WHERE vendor_id = $1 AND invoice_number = $2 AND invoice_number IS NOT NULL
          AND ${SUCCESSFUL_PAYMENT_FILTER}
      ) AS duplicate_invoice_number,
      EXISTS (
        SELECT 1 FROM payments
        WHERE vendor_id = $1 AND amount_micros = $3
          AND ts >= now() - INTERVAL '14 days'
          AND ${SUCCESSFUL_PAYMENT_FILTER}
      ) AS duplicate_amount_within_14_days
  `;
  const params = [vendorId, invoiceNumber, amountMicros.toString()];
  const rows = await sql.unsafe<{ duplicate_invoice_number: boolean; duplicate_amount_within_14_days: boolean }[]>(text, params);
  const result: DuplicateInvoiceResult = {
    duplicateInvoiceNumber: rows[0]?.duplicate_invoice_number ?? false,
    duplicateAmountWithin14Days: rows[0]?.duplicate_amount_within_14_days ?? false,
  };
  return { name: "isDuplicateInvoice", sql: text, params, result };
}

/**
 * recent_unverified_change: payee equals an unverified
 * vendor_detail_changes.new_address from the last 30 days.
 */
export async function recentUnverifiedChange(payeeAddress: string): Promise<PolicyQueryResult<boolean>> {
  const sql = getDb();
  const text = `
    SELECT EXISTS (
      SELECT 1 FROM vendor_detail_changes
      WHERE new_address = $1
        AND verified = false
        AND ts >= now() - INTERVAL '30 days'
    ) AS exists
  `;
  const rows = await sql.unsafe<{ exists: boolean }[]>(text, [payeeAddress]);
  return { name: "recentUnverifiedChange", sql: text, params: [payeeAddress], result: rows[0]?.exists ?? false };
}
