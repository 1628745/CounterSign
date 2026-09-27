import { appendEvent, type AgentEventInput, type AgentEventKind } from "@/lib/db/events";

/** A persisted agent_events row, shaped for both the CLI trace and the future SSE/UI layer. */
export interface PersistedEvent {
  seq: bigint;
  runId: string;
  kind: AgentEventKind;
  emailId: string | null;
  paymentId: string | null;
  payload: Record<string, unknown>;
  ts: string;
}

const subscribers = new Map<string, Set<(event: PersistedEvent) => void>>();

/** Live subscription for one run — used by src/lib/runs/index.ts's async-iterator and the SSE route. */
export function subscribeToRun(runId: string, listener: (event: PersistedEvent) => void): () => void {
  let set = subscribers.get(runId);
  if (!set) {
    set = new Set();
    subscribers.set(runId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) {
      subscribers.delete(runId);
    }
  };
}

/**
 * Write-then-show (SPEC.md section 14, non-negotiable #3): persists the
 * event to Tiger Data first, then notifies any live subscriber for this
 * run_id. Every part of the agent/pipeline/runs layer emits events through
 * this single function so nothing can show up in a live stream without
 * having been durably written first.
 */
export async function emitEvent(input: AgentEventInput): Promise<PersistedEvent> {
  const { seq } = await appendEvent(input);
  const event: PersistedEvent = {
    seq,
    runId: input.runId,
    kind: input.kind,
    emailId: input.emailId ?? null,
    paymentId: input.paymentId ?? null,
    payload: input.payload,
    ts: new Date().toISOString(),
  };
  const set = subscribers.get(input.runId);
  if (set) {
    for (const listener of set) listener(event);
  }
  return event;
}
