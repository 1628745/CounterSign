/**
 * Builds the on-chain memo string tying a payment to its decision:
 * countersign:v1|pay=<first 8 of payment_id>|dec=<decision>|risk=<score>|appr=<first 10 hex of sha256(auth_req_id) or none>
 * (SPEC.md section 6).
 *
 * TODO(solana prompt): implement.
 */
export function buildMemo(params: {
  paymentId: string;
  decision: string;
  riskScore: number;
  authReqId?: string;
}): string {
  void params;
  throw new Error("TODO: implement buildMemo — see SPEC.md section 6");
}
