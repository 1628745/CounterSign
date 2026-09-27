import type { PaymentIntent } from "@/lib/countersign/types";
import { insertPayment, updatePaymentTx } from "@/lib/db/queries/payments";
import { emitEvent } from "@/lib/runs/eventBus";
import { explorerTxUrl } from "@/lib/solana/explorer";

export type Mode = "naive" | "guarded";

export interface SubmitPaymentContext {
  runId: string;
  pack: string;
}

export interface SubmitPaymentResult {
  paymentId: string;
  decision: string;
  /** Short, rule-free message for the agent's tool result (SPEC.md section 9). */
  message: string;
  signature?: string;
  explorerUrl?: string;
}

/**
 * The one door the agent is allowed to knock on. Routes:
 *   naive   -> records the payment (decision naive_paid) and pays immediately
 *   guarded -> src/lib/countersign/gateway.submitToGateway
 * This is the ONLY pipeline interface the agent may import (SPEC.md
 * section 3 and non-negotiable #1) — it never imports the signer itself.
 */
export async function submitPayment(
  intent: PaymentIntent,
  mode: Mode,
  context: SubmitPaymentContext,
): Promise<SubmitPaymentResult> {
  if (mode === "guarded") {
    const { submitToGateway } = await import("@/lib/countersign/gateway");
    const result = await submitToGateway(intent, { runId: context.runId, pack: context.pack });
    return {
      paymentId: result.paymentId,
      decision: result.decision,
      message: result.message,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    };
  }

  const paymentId = await insertPayment({
    runId: context.runId,
    mode: "naive",
    vendorId: intent.vendor,
    payeeAddress: intent.payeeAddress,
    amountMicros: intent.amountMicros,
    invoiceNumber: intent.invoiceNumber,
    sourceEmailId: intent.sourceEmailId,
    decision: "naive_paid",
  });

  await emitEvent({
    runId: context.runId,
    kind: "tx_submitted",
    emailId: intent.sourceEmailId ?? undefined,
    paymentId,
    payload: { payeeAddress: intent.payeeAddress, amountMicros: intent.amountMicros.toString() },
  });

  // Dynamic import: @solana/web3.js's dependency chain (rpc-websockets ->
  // an inner uuid copy) trips a CJS/ESM interop bug under some module
  // loaders (observed under Vitest, not tsx). Deferring the import to here
  // means tests that only inspect tool metadata (never actually pay
  // anything) never load it at all.
  const { executePayment } = await import("@/lib/solana/signer");
  const { signature } = await executePayment(paymentId);
  await updatePaymentTx(paymentId, { txSignature: signature, txStatus: "confirmed" });

  const explorerUrl = explorerTxUrl(signature);
  await emitEvent({
    runId: context.runId,
    kind: "tx_confirmed",
    emailId: intent.sourceEmailId ?? undefined,
    paymentId,
    payload: { signature, explorerUrl },
  });

  return { paymentId, decision: "naive_paid", message: "paid", signature, explorerUrl };
}
