import { poll } from "@/lib/auth0/ciba";
import { dueApprovals, rescheduleApproval, resolveApproval } from "@/lib/db/queries/approvals";
import { getPaymentById, updatePaymentDecision, updatePaymentTx } from "@/lib/db/queries/payments";
import { emitEvent } from "@/lib/runs/eventBus";
import { explorerTxUrl } from "@/lib/solana/explorer";

export interface ApprovalAdvance {
  approvalId: string;
  paymentId: string;
  status: "pending" | "approved" | "denied" | "expired";
  signature?: string;
}

/**
 * Advances every approval whose next_poll_at has passed (SPEC.md section
 * 9): polls CIBA, respects slow_down backoff. Approved -> verifies the
 * token (already done inside ciba.poll), stores its fingerprint, sets
 * decision=approved, and has the signer execute (with the approval hash in
 * the memo, via signer.ts's authReqId plumbing). Denied/expired -> sets the
 * decision, no transaction. Writes approval_resolved events. Shared by
 * POST /api/approvals/poll and the CLI's guarded-mode wait loop.
 */
export async function advancePendingApprovals(): Promise<ApprovalAdvance[]> {
  const due = await dueApprovals();
  const advances: ApprovalAdvance[] = [];

  for (const approval of due) {
    const payment = await getPaymentById(approval.paymentId);
    const runId = payment?.runId ?? null;

    const outcome = await poll(approval.authReqId, approval.approverSub);

    if (outcome.status === "pending") {
      const intervalS = outcome.intervalS ?? approval.intervalS;
      await rescheduleApproval(approval.id, new Date(Date.now() + intervalS * 1000), intervalS);
      advances.push({ approvalId: approval.id, paymentId: approval.paymentId, status: "pending" });
      continue;
    }

    if (outcome.status === "denied" || outcome.status === "expired") {
      await resolveApproval(approval.id, { status: outcome.status });
      await updatePaymentDecision(approval.paymentId, outcome.status);
      if (runId) {
        await emitEvent({ runId, kind: "approval_resolved", paymentId: approval.paymentId, payload: { status: outcome.status } });
      }
      advances.push({ approvalId: approval.id, paymentId: approval.paymentId, status: outcome.status });
      continue;
    }

    // approved
    await resolveApproval(approval.id, { status: "approved", tokenFingerprint: outcome.tokenFingerprint });
    await updatePaymentDecision(approval.paymentId, "approved");
    if (runId) {
      await emitEvent({
        runId,
        kind: "approval_resolved",
        paymentId: approval.paymentId,
        payload: { status: "approved", tokenFingerprint: outcome.tokenFingerprint },
      });
      await emitEvent({
        runId,
        kind: "tx_submitted",
        paymentId: approval.paymentId,
        payload: { authReqId: approval.authReqId },
      });
    }

    const { executePayment } = await import("@/lib/solana/signer");
    const { signature } = await executePayment(approval.paymentId);
    await updatePaymentTx(approval.paymentId, { txSignature: signature, txStatus: "confirmed" });

    if (runId) {
      await emitEvent({
        runId,
        kind: "tx_confirmed",
        paymentId: approval.paymentId,
        payload: { signature, explorerUrl: explorerTxUrl(signature) },
      });
    }
    advances.push({ approvalId: approval.id, paymentId: approval.paymentId, status: "approved", signature });
  }

  return advances;
}
