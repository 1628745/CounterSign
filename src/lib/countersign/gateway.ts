import type { PaymentIntent } from "./types";

/**
 * Orchestrates the guarded payment flow (SPEC.md section 3):
 *   1. write a payment_proposed agent_event (write-then-show, non-negotiable #3)
 *   2. assemble a PolicyContext from Tiger Data
 *   3. call policy.evaluate (pure)
 *   4. write a risk_scored event, then route:
 *        auto_pay            -> src/lib/solana/signer.executePayment
 *        approval_required   -> src/lib/auth0/ciba.initiate (non-blocking)
 *        blocked              -> log only
 *
 * TODO(gateway prompt): implement. The gateway decides when approval is
 * needed — never the agent (SPEC.md section 9).
 */
export async function submitToGateway(intent: PaymentIntent): Promise<void> {
  void intent;
  throw new Error("TODO: implement gateway.submitToGateway — see SPEC.md section 3");
}
