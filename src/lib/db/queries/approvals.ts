/**
 * Reads/writes against the approvals table, backing src/lib/auth0/ciba.ts
 * and POST /api/approvals/poll (SPEC.md sections 5 and 9).
 * TODO(auth0 prompt): implement.
 */
export async function createApproval(params: {
  paymentId: string;
  authReqId: string;
  bindingMessage: string;
  expiresAt: Date;
  intervalS: number;
}): Promise<string> {
  void params;
  throw new Error("TODO: implement createApproval — see SPEC.md section 9");
}

export async function dueApprovals(): Promise<unknown[]> {
  throw new Error("TODO: implement dueApprovals — see SPEC.md section 9");
}
