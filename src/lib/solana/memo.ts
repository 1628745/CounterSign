import { createHash } from "node:crypto";

/**
 * Builds the on-chain memo string tying a payment to its decision:
 * countersign:v1|pay=<first 8 of payment_id>|dec=<decision>|risk=<score>|appr=<first 10 hex of sha256(auth_req_id) or none>
 * (SPEC.md section 6).
 */
export function buildMemo(params: {
  paymentId: string;
  decision: string;
  riskScore: number;
  authReqId?: string;
}): string {
  const pay = params.paymentId.slice(0, 8);
  const appr = params.authReqId
    ? createHash("sha256").update(params.authReqId).digest("hex").slice(0, 10)
    : "none";
  return `countersign:v1|pay=${pay}|dec=${params.decision}|risk=${params.riskScore}|appr=${appr}`;
}
