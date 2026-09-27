/**
 * THE ONLY MODULE ALLOWED TO LOAD THE TREASURY SECRET (SPEC.md section 3
 * and non-negotiable #1). Nothing under src/lib/agent/** may import this
 * file or read any *_SECRET_KEY env var directly.
 *
 * executePayment() re-reads the payment and its decision from Tiger Data
 * and refuses unless: decision = auto_pay; or decision = approved with a
 * stored, verified Auth0 approval; or mode = naive (SPEC.md section 6).
 *
 * TODO(solana prompt): implement transferChecked + Memo instruction,
 * simulateTransaction before sending, confirm at 'confirmed', store the
 * signature.
 */
export async function executePayment(paymentId: string): Promise<{ signature: string }> {
  void paymentId;
  throw new Error("TODO: implement signer.executePayment — see SPEC.md section 6");
}
