import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { getLatestApprovalForPayment } from "@/lib/db/queries/approvals";
import { getPaymentById } from "@/lib/db/queries/payments";
import { getLatestRiskEvaluation } from "@/lib/db/queries/riskEvaluations";
import { explorerTxUrl } from "@/lib/solana/explorer";

/**
 * GET /api/payments/[id] — everything a decision card needs (SPEC.md
 * section 10): intent, score, signals with evidence, provenance
 * occurrences, approval state and countdown, simulated balance deltas, tx
 * signature and explorer link. Needs a session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payment = await getPaymentById(id);
  if (!payment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const [risk, approval] = await Promise.all([getLatestRiskEvaluation(id), getLatestApprovalForPayment(id)]);

  const now = Date.now();
  const countdownSeconds = approval && approval.status === "pending" ? Math.max(0, Math.round((approval.nextPollAt.getTime() - now) / 1000)) : null;
  const expiresInSeconds = approval && approval.status === "pending" ? Math.max(0, Math.round((approval.expiresAt.getTime() - now) / 1000)) : null;

  // Money is bigint micro-units in Tiger Data; this is the UI-facing display boundary (non-negotiable #4).
  const amountDollars = Number(payment.amountMicros) / 1_000_000;

  return NextResponse.json({
    payment: {
      paymentId: payment.paymentId,
      ts: payment.ts,
      mode: payment.mode,
      vendorId: payment.vendorId,
      payeeAddress: payment.payeeAddress,
      amountMicros: payment.amountMicros.toString(),
      invoiceNumber: payment.invoiceNumber,
      sourceEmailId: payment.sourceEmailId,
      decision: payment.decision,
      riskScore: payment.riskScore,
      txSignature: payment.txSignature,
      txStatus: payment.txStatus,
      explorerUrl: payment.txSignature ? explorerTxUrl(payment.txSignature) : null,
    },
    risk: risk ? { score: risk.score, decision: risk.decision, signals: risk.signals, provenance: risk.provenance } : null,
    approval: approval
      ? {
          status: approval.status,
          bindingMessage: approval.bindingMessage,
          requestedAt: approval.requestedAt,
          expiresAt: approval.expiresAt,
          resolvedAt: approval.resolvedAt,
          countdownSeconds,
          expiresInSeconds,
        }
      : null,
    simulatedBalanceDeltas: { treasury: -amountDollars, payee: amountDollars },
  });
}
