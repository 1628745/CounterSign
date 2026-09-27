import { initiate, sanitizeBindingMessage } from "@/lib/auth0/ciba";
import { createApproval } from "@/lib/db/queries/approvals";
import { getInboxEmailById } from "@/lib/db/queries/emails";
import { insertPayment, updatePaymentTx, type PaymentDecision } from "@/lib/db/queries/payments";
import {
  hasSuccessfulPaymentTo as hasSuccessfulPaymentToQuery,
  isDuplicateInvoice as isDuplicateInvoiceQuery,
  recentUnverifiedChange as recentUnverifiedChangeQuery,
  vendorMaxDaily90d as vendorMaxDaily90dQuery,
  vendorMedian90d as vendorMedian90dQuery,
  vendorSpendToday as vendorSpendTodayQuery,
} from "@/lib/db/queries/policyQueries";
import { listVendorsWithNotes } from "@/lib/db/queries/vendors";
import { insertRiskEvaluation } from "@/lib/db/queries/riskEvaluations";
import { emitEvent } from "@/lib/runs/eventBus";
import { explorerTxUrl } from "@/lib/solana/explorer";
import { classifyFraudLikelihood } from "./classifier";
import { checkExecImpersonation } from "./execImpersonation";
import { renderNaiveEmail } from "./htmlText";
import { checkLookalikeSender } from "./lookalike";
import { evaluate } from "./policy";
import { detectPressure } from "./pressure";
import { findProvenance } from "./provenance";
import type { Decision, EmailInfo, PaymentIntent, PolicyContext } from "./types";

function toPaymentDecision(decision: Decision): PaymentDecision {
  if (decision === "approval_required") return "approval_pending";
  return decision;
}

function formatDollars(micros: bigint): string {
  return (Number(micros) / 1_000_000).toFixed(2);
}

function shortAddress(address: string): string {
  return address.length <= 10 ? address : `${address.slice(0, 4)}..${address.slice(-4)}`;
}

/** Exported for scripts/doctor.ts's offline E1-E8 policy self-test — read-only, no side effects. */
export async function buildPolicyContext(intent: PaymentIntent, pack: string): Promise<PolicyContext> {
  const now = new Date();

  const vendors = await listVendorsWithNotes();
  const vendor = intent.vendor ? vendors.find((v) => v.id === intent.vendor) ?? null : null;
  const verifiedAddresses = vendors.map((v) => v.verifiedAddress);

  const sourceEmailRow = await getInboxEmailById(intent.sourceEmailId);
  let sourceEmail: EmailInfo | null = null;
  if (sourceEmailRow) {
    const { text, hiddenSpans } = renderNaiveEmail(sourceEmailRow.html);
    sourceEmail = {
      id: sourceEmailRow.id,
      fromName: sourceEmailRow.fromName,
      fromAddress: sourceEmailRow.fromAddress,
      subject: sourceEmailRow.subject,
      receivedAt: sourceEmailRow.receivedAt,
      text,
      hiddenSpans: hiddenSpans.map((s) => ({ offsetStart: s.offsetStart, offsetEnd: s.offsetEnd })),
    };
  }

  const provenance = await findProvenance(intent.payeeAddress, pack);
  const firstEmailHit = provenance.hits.find((h) => h.source === "email");
  const firstAppearanceLookalike = firstEmailHit?.sender ? checkLookalikeSender(firstEmailHit.sender) : null;

  const [recentChange, hasPaid, median, maxDaily, spendToday, duplicate] = await Promise.all([
    recentUnverifiedChangeQuery(intent.payeeAddress),
    hasSuccessfulPaymentToQuery(intent.payeeAddress),
    vendor ? vendorMedian90dQuery(vendor.id) : Promise.resolve({ name: "vendorMedian90d", result: null }),
    vendor ? vendorMaxDaily90dQuery(vendor.id) : Promise.resolve({ name: "vendorMaxDaily90d", result: null }),
    vendor ? vendorSpendTodayQuery(vendor.id) : Promise.resolve({ name: "vendorSpendToday", result: 0 }),
    vendor
      ? isDuplicateInvoiceQuery(vendor.id, intent.invoiceNumber, intent.amountMicros)
      : Promise.resolve({ name: "isDuplicateInvoice", result: { duplicateInvoiceNumber: false, duplicateAmountWithin14Days: false } }),
  ]);

  const classifier = sourceEmailRow
    ? await classifyFraudLikelihood(sourceEmailRow.id, sourceEmailRow.html)
    : { fraud_likelihood: 0, cues: [] };

  return {
    now,
    vendor,
    sourceEmail,
    verifiedAddresses,
    provenance,
    firstAppearanceLookalike,
    recentUnverifiedChange: { result: recentChange.result, query: recentChange.name },
    hasSuccessfulPaymentTo: { result: hasPaid.result, query: hasPaid.name },
    vendorMedian90d: { result: median.result, query: median.name },
    vendorMaxDaily90d: { result: maxDaily.result, query: maxDaily.name },
    vendorSpendToday: { result: spendToday.result, query: spendToday.name },
    duplicateInvoice: { result: duplicate.result, query: duplicate.name },
    lookalikeSender: sourceEmail ? checkLookalikeSender(sourceEmail.fromAddress) : { isLookalike: false, imitates: null, technique: null },
    pressure: sourceEmail ? detectPressure(sourceEmail.text) : { fired: false, matches: [] },
    execImpersonation: sourceEmail
      ? checkExecImpersonation(sourceEmail.fromName, sourceEmail.fromAddress)
      : { fired: false, claimedName: null, senderDomain: "" },
    classifier,
  };
}

export interface GatewayResult {
  paymentId: string;
  decision: Decision;
  /** Short, rule-free message for the agent's tool result (SPEC.md section 9 — it never sees scores or rules). */
  message: string;
  signature?: string;
  explorerUrl?: string;
}

export interface SubmitToGatewayContext {
  runId: string;
  pack: string;
}

/**
 * Orchestrates the guarded payment flow (SPEC.md section 3): builds the
 * policy context (DB queries, detectors, provenance), calls the pure
 * evaluate(), writes risk_evaluations + a risk_scored event, then routes:
 *   auto_pay          -> signer.executePayment
 *   approval_required -> CIBA initiate (non-blocking), write approvals + approval_requested
 *   blocked           -> payment_blocked event, no transaction
 * The gateway decides when approval is needed — never the agent (SPEC.md
 * section 9). The agent only ever sees `message` — never the score or
 * which signals fired, so it can't learn to route around the policy.
 */
export async function submitToGateway(intent: PaymentIntent, context: SubmitToGatewayContext): Promise<GatewayResult> {
  const policyContext = await buildPolicyContext(intent, context.pack);
  const result = evaluate(intent, policyContext);

  const paymentId = await insertPayment({
    runId: context.runId,
    mode: "guarded",
    vendorId: intent.vendor,
    payeeAddress: intent.payeeAddress,
    amountMicros: intent.amountMicros,
    invoiceNumber: intent.invoiceNumber,
    sourceEmailId: intent.sourceEmailId,
    decision: toPaymentDecision(result.decision),
    riskScore: result.score,
  });

  await insertRiskEvaluation({
    paymentId,
    runId: context.runId,
    score: result.score,
    decision: result.decision,
    signals: result.signals,
    provenance: result.provenance,
  });

  const firedSignals = result.signals.filter((s) => s.fired).sort((a, b) => b.weight - a.weight);
  const topReasons = firedSignals.slice(0, 3).map((s) => s.evidence.sentence);
  const topLabel = firedSignals[0]?.label.toLowerCase() ?? "policy violation";

  await emitEvent({
    runId: context.runId,
    kind: "risk_scored",
    emailId: intent.sourceEmailId,
    paymentId,
    payload: { score: result.score, decision: result.decision, topReasons },
  });

  if (result.decision === "auto_pay") {
    const { executePayment } = await import("@/lib/solana/signer");
    await emitEvent({
      runId: context.runId,
      kind: "tx_submitted",
      emailId: intent.sourceEmailId,
      paymentId,
      payload: { payeeAddress: intent.payeeAddress, amountMicros: intent.amountMicros.toString() },
    });
    const { signature } = await executePayment(paymentId);
    await updatePaymentTx(paymentId, { txSignature: signature, txStatus: "confirmed" });
    const explorerUrl = explorerTxUrl(signature);
    await emitEvent({
      runId: context.runId,
      kind: "tx_confirmed",
      emailId: intent.sourceEmailId,
      paymentId,
      payload: { signature, explorerUrl },
    });
    return { paymentId, decision: "auto_pay", message: "paid", signature, explorerUrl };
  }

  if (result.decision === "approval_required") {
    const approverSub = process.env.APPROVER_SUB;
    if (!approverSub) {
      throw new Error("APPROVER_SUB is not set — cannot request approval (see .env.example)");
    }
    const newPayeeSuffix = policyContext.hasSuccessfulPaymentTo.result ? "" : " new payee";
    const bindingMessage = sanitizeBindingMessage(
      `Pay ${formatDollars(intent.amountMicros)} mUSDC to ${shortAddress(intent.payeeAddress)}${newPayeeSuffix}`,
    );
    const { authReqId, expiresIn, interval } = await initiate(bindingMessage, approverSub);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await createApproval({ paymentId, authReqId, bindingMessage, approverSub, expiresAt, intervalS: interval });
    await emitEvent({
      runId: context.runId,
      kind: "approval_requested",
      emailId: intent.sourceEmailId,
      paymentId,
      payload: { authReqId, bindingMessage, expiresAt: expiresAt.toISOString() },
    });
    return { paymentId, decision: "approval_required", message: "held for approval" };
  }

  // blocked
  await emitEvent({
    runId: context.runId,
    kind: "payment_blocked",
    emailId: intent.sourceEmailId,
    paymentId,
    payload: { topReasons },
  });
  return { paymentId, decision: "blocked", message: `blocked: ${topLabel}` };
}
