import { getDb } from "./client";

export type AgentEventKind =
  | "run_started"
  | "email_read"
  | "tool_call"
  | "tool_result"
  | "agent_message"
  | "vendor_change"
  | "payment_proposed"
  | "risk_scored"
  | "approval_requested"
  | "approval_resolved"
  | "tx_submitted"
  | "tx_confirmed"
  | "payment_blocked"
  | "run_finished"
  | "error";

export interface AgentEventInput {
  runId: string;
  kind: AgentEventKind;
  emailId?: string;
  paymentId?: string;
  payload: Record<string, unknown>;
}

/**
 * Append-only event writer. Non-negotiable #3 (write-then-show): every step
 * must persist its agent_events row to Tiger Data BEFORE it is emitted to
 * the UI (e.g. over SSE). See SPEC.md sections 3, 5 and 10.
 *
 * seq is assigned inside a transaction holding a per-run advisory lock, so
 * concurrent writers for the same run_id (e.g. a tool call and its result
 * landing close together) still get a gap-free, monotonically increasing
 * sequence instead of racing on max(seq)+1.
 */
export async function appendEvent(event: AgentEventInput): Promise<{ seq: bigint }> {
  const sql = getDb();
  const seq = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${event.runId}, 0))`;
    const [{ nextSeq }] = await tx<{ nextSeq: string }[]>`
      SELECT coalesce(max(seq), 0) + 1 AS "nextSeq" FROM agent_events WHERE run_id = ${event.runId}
    `;
    await tx`
      INSERT INTO agent_events (run_id, seq, kind, email_id, payment_id, payload)
      VALUES (
        ${event.runId}, ${nextSeq}, ${event.kind},
        ${event.emailId ?? null}, ${event.paymentId ?? null}, ${tx.json(JSON.parse(JSON.stringify(event.payload)))}
      )
    `;
    return BigInt(nextSeq);
  });
  return { seq };
}
