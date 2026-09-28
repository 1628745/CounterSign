import type { ClientEvent, PaymentDetailDTO } from "./types";
import type { RunStatus } from "./store";

export type EmailOutcome = "paid" | "held" | "blocked" | "declined" | "expired" | "vendor_change" | "read_only" | null;

export interface EmailRunState {
  read: boolean;
  paymentId: string | null;
  outcome: EmailOutcome;
}

/** The email the agent is currently reading, for the inbox slip's ink-bar indicator (docs/DESIGN.md A6). */
export function getActiveReadingEmailId(events: ClientEvent[], runStatus: RunStatus): string | null {
  if (runStatus !== "running") return null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === "email_read") return events[i].emailId;
  }
  return null;
}

function outcomeFromPayment(payment: PaymentDetailDTO | undefined): EmailOutcome {
  if (!payment) return null;
  const decision = payment.payment.decision;
  const txConfirmed = payment.payment.txStatus === "confirmed";
  if (decision === "naive_paid" || decision === "auto_pay") return txConfirmed ? "paid" : "held";
  if (decision === "approved") return txConfirmed ? "paid" : "held";
  if (decision === "approval_pending") return "held";
  if (decision === "denied") return "declined";
  if (decision === "expired") return "expired";
  if (decision === "blocked") return "blocked";
  return null;
}

/** Per-slip state — read/processed, outcome glyph, and the paymentId a DecisionCard should scroll to (docs/DESIGN.md A6). */
export function getEmailRunState(emailId: string, events: ClientEvent[], payments: Record<string, PaymentDetailDTO>): EmailRunState {
  let read = false;
  let paymentId: string | null = null;
  let vendorChanged = false;

  for (const event of events) {
    if (event.emailId !== emailId) continue;
    if (event.kind === "email_read") read = true;
    if (event.kind === "payment_proposed" && event.paymentId) paymentId = event.paymentId;
    if (event.kind === "vendor_change") vendorChanged = true;
  }

  if (paymentId) {
    const outcome = outcomeFromPayment(payments[paymentId]);
    return { read, paymentId, outcome };
  }
  if (vendorChanged) return { read, paymentId: null, outcome: "vendor_change" };
  if (read) return { read, paymentId: null, outcome: "read_only" };
  return { read: false, paymentId: null, outcome: null };
}

/** Payment ids currently awaiting a human decision — the Money column's "Waiting on you" queue. */
export function getPendingApprovalPaymentIds(events: ClientEvent[]): string[] {
  const requested = new Set<string>();
  const resolved = new Set<string>();
  for (const event of events) {
    if (!event.paymentId) continue;
    if (event.kind === "approval_requested") requested.add(event.paymentId);
    if (event.kind === "approval_resolved") resolved.add(event.paymentId);
  }
  return [...requested].filter((id) => !resolved.has(id));
}

/** Seconds between tx_submitted and tx_confirmed for a payment — the DecisionCard's "Confirmed on Solana in Xs." */
export function getTxElapsedSeconds(paymentId: string, events: ClientEvent[]): number | null {
  let submittedAt: number | null = null;
  let confirmedAt: number | null = null;
  for (const event of events) {
    if (event.paymentId !== paymentId) continue;
    if (event.kind === "tx_submitted") submittedAt = new Date(event.ts).getTime();
    if (event.kind === "tx_confirmed") confirmedAt = new Date(event.ts).getTime();
  }
  if (submittedAt === null || confirmedAt === null) return null;
  return Math.max(0, (confirmedAt - submittedAt) / 1000);
}
