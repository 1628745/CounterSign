import type { PaymentIntent } from "@/lib/countersign/types";

export type Mode = "naive" | "guarded";

/**
 * The one door the agent is allowed to knock on. Routes:
 *   naive   -> src/lib/solana/signer.executePayment directly
 *   guarded -> src/lib/countersign/gateway.submitToGateway
 * This is the ONLY pipeline interface the agent may import (SPEC.md
 * section 3 and non-negotiable #1) — it never imports the signer itself.
 *
 * TODO(pipeline prompt): implement.
 */
export async function submitPayment(intent: PaymentIntent, mode: Mode): Promise<void> {
  void intent;
  void mode;
  throw new Error("TODO: implement pipeline.submitPayment — see SPEC.md section 3");
}
