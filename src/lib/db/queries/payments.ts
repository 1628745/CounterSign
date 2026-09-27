import { randomUUID } from "node:crypto";
import { getDb } from "../client";

export type PaymentMode = "history" | "naive" | "guarded";
export type PaymentDecision =
  | "history"
  | "naive_paid"
  | "auto_pay"
  | "approval_pending"
  | "approved"
  | "denied"
  | "expired"
  | "blocked";
export type TxStatus = "none" | "submitted" | "confirmed" | "failed";

export interface PaymentRow {
  ts: Date;
  paymentId: string;
  runId: string | null;
  mode: PaymentMode;
  vendorId: string | null;
  payeeAddress: string;
  amountMicros: bigint;
  invoiceNumber: string | null;
  sourceEmailId: string | null;
  decision: PaymentDecision;
  riskScore: number | null;
  txSignature: string | null;
  txStatus: TxStatus;
}

export interface NewPayment {
  ts?: Date;
  paymentId?: string;
  runId?: string | null;
  mode: PaymentMode;
  vendorId?: string | null;
  payeeAddress: string;
  amountMicros: bigint;
  invoiceNumber?: string | null;
  sourceEmailId?: string | null;
  decision: PaymentDecision;
  riskScore?: number | null;
  txSignature?: string | null;
  txStatus?: TxStatus;
}

interface PaymentDbRow {
  ts: Date;
  payment_id: string;
  run_id: string | null;
  mode: PaymentMode;
  vendor_id: string | null;
  payee_address: string;
  amount_micros: string;
  invoice_number: string | null;
  source_email_id: string | null;
  decision: PaymentDecision;
  risk_score: number | null;
  tx_signature: string | null;
  tx_status: TxStatus;
}

function mapRow(row: PaymentDbRow): PaymentRow {
  return {
    ts: row.ts,
    paymentId: row.payment_id,
    runId: row.run_id,
    mode: row.mode,
    vendorId: row.vendor_id,
    payeeAddress: row.payee_address,
    amountMicros: BigInt(row.amount_micros),
    invoiceNumber: row.invoice_number,
    sourceEmailId: row.source_email_id,
    decision: row.decision,
    riskScore: row.risk_score,
    txSignature: row.tx_signature,
    txStatus: row.tx_status,
  };
}

/** Reads/writes against the payments hypertable (SPEC.md section 5). */
export async function insertPayment(payment: NewPayment): Promise<string> {
  const sql = getDb();
  const paymentId = payment.paymentId ?? randomUUID();
  const rows = await sql<{ payment_id: string }[]>`
    INSERT INTO payments (
      ts, payment_id, run_id, mode, vendor_id, payee_address, amount_micros,
      invoice_number, source_email_id, decision, risk_score, tx_signature, tx_status
    ) VALUES (
      ${payment.ts ?? new Date()}, ${paymentId}, ${payment.runId ?? null}, ${payment.mode},
      ${payment.vendorId ?? null}, ${payment.payeeAddress}, ${payment.amountMicros.toString()},
      ${payment.invoiceNumber ?? null}, ${payment.sourceEmailId ?? null}, ${payment.decision},
      ${payment.riskScore ?? null}, ${payment.txSignature ?? null}, ${payment.txStatus ?? "none"}
    )
    RETURNING payment_id
  `;
  return rows[0].payment_id;
}

/** Most recent row for a payment_id — decisions/tx_status can be updated by later rows. */
export async function getPaymentById(paymentId: string): Promise<PaymentRow | null> {
  const sql = getDb();
  const rows = await sql<PaymentDbRow[]>`
    SELECT * FROM payments WHERE payment_id = ${paymentId} ORDER BY ts DESC LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function lookupPaymentHistory(vendorId: string): Promise<PaymentRow[]> {
  const sql = getDb();
  const rows = await sql<PaymentDbRow[]>`
    SELECT * FROM payments WHERE vendor_id = ${vendorId} ORDER BY ts DESC LIMIT 200
  `;
  return rows.map(mapRow);
}

/** Advances a payment's decision after a CIBA approval resolves (approved/denied/expired). */
export async function updatePaymentDecision(paymentId: string, decision: PaymentDecision): Promise<void> {
  const sql = getDb();
  await sql`UPDATE payments SET decision = ${decision} WHERE payment_id = ${paymentId}`;
}

/** Records the on-chain outcome of a payment after src/lib/solana/signer.executePayment runs. */
export async function updatePaymentTx(paymentId: string, update: { txSignature: string; txStatus: TxStatus }): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE payments SET tx_signature = ${update.txSignature}, tx_status = ${update.txStatus}
    WHERE payment_id = ${paymentId}
  `;
}
