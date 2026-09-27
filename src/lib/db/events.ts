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
 * TODO(tiger data prompt): implement, assigning a monotonically increasing
 * `seq` per run_id.
 */
export async function appendEvent(event: AgentEventInput): Promise<void> {
  void event;
  throw new Error("TODO: implement appendEvent — see SPEC.md section 10");
}
