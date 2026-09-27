import { getDb } from "../client";

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface ApprovalRow {
  id: string;
  paymentId: string;
  authReqId: string;
  bindingMessage: string;
  status: ApprovalStatus;
  requestedAt: Date;
  expiresAt: Date;
  nextPollAt: Date;
  intervalS: number;
  resolvedAt: Date | null;
  approverSub: string;
  tokenFingerprint: string | null;
}

interface ApprovalDbRow {
  id: string;
  payment_id: string;
  auth_req_id: string;
  binding_message: string;
  status: ApprovalStatus;
  requested_at: Date;
  expires_at: Date;
  next_poll_at: Date;
  interval_s: number;
  resolved_at: Date | null;
  approver_sub: string;
  token_fingerprint: string | null;
}

function mapRow(row: ApprovalDbRow): ApprovalRow {
  return {
    id: row.id,
    paymentId: row.payment_id,
    authReqId: row.auth_req_id,
    bindingMessage: row.binding_message,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    nextPollAt: row.next_poll_at,
    intervalS: row.interval_s,
    resolvedAt: row.resolved_at,
    approverSub: row.approver_sub,
    tokenFingerprint: row.token_fingerprint,
  };
}

/**
 * Reads/writes against the approvals table, backing src/lib/auth0/ciba.ts
 * and POST /api/approvals/poll (SPEC.md sections 5 and 9).
 */
export async function createApproval(params: {
  paymentId: string;
  authReqId: string;
  bindingMessage: string;
  approverSub: string;
  expiresAt: Date;
  intervalS: number;
}): Promise<string> {
  const sql = getDb();
  const nextPollAt = new Date(Date.now() + params.intervalS * 1000);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO approvals (payment_id, auth_req_id, binding_message, approver_sub, expires_at, next_poll_at, interval_s)
    VALUES (${params.paymentId}, ${params.authReqId}, ${params.bindingMessage}, ${params.approverSub}, ${params.expiresAt}, ${nextPollAt}, ${params.intervalS})
    RETURNING id
  `;
  return rows[0].id;
}

export async function dueApprovals(): Promise<ApprovalRow[]> {
  const sql = getDb();
  const rows = await sql<ApprovalDbRow[]>`
    SELECT * FROM approvals WHERE status = 'pending' AND next_poll_at <= now() ORDER BY next_poll_at ASC
  `;
  return rows.map(mapRow);
}

/** Used by src/lib/solana/signer.ts to verify a decision = 'approved' payment has a stored, verified approval. */
export async function getLatestApprovalForPayment(paymentId: string): Promise<ApprovalRow | null> {
  const sql = getDb();
  const rows = await sql<ApprovalDbRow[]>`
    SELECT * FROM approvals WHERE payment_id = ${paymentId} ORDER BY requested_at DESC LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}
