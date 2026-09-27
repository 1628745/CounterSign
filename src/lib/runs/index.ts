import { randomUUID } from "node:crypto";
import { runAgent } from "@/lib/agent";
import { createRun, finishRun } from "@/lib/db/queries/runs";
import type { Mode } from "@/lib/pipeline";
import { emitEvent, subscribeToRun, type PersistedEvent } from "./eventBus";

export interface StartRunOptions {
  mode: Mode;
  pack: string;
}

export interface RunOutcome {
  status: "completed" | "failed";
  summary: string | null;
}

export interface RunHandle {
  runId: string;
  /** Streams events as they're persisted (SPEC.md section 3's "write-then-show"). */
  events: AsyncIterable<PersistedEvent>;
  done: Promise<RunOutcome>;
}

/** Minimal async queue: push() feeds any waiting `next()`, close() ends iteration. */
class AsyncEventQueue implements AsyncIterable<PersistedEvent> {
  private buffered: PersistedEvent[] = [];
  private waiters: ((result: IteratorResult<PersistedEvent>) => void)[] = [];
  private closed = false;

  push(event: PersistedEvent): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this.buffered.push(event);
    }
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<PersistedEvent> {
    return {
      next: (): Promise<IteratorResult<PersistedEvent>> => {
        const buffered = this.buffered.shift();
        if (buffered) {
          return Promise.resolve({ value: buffered, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

/**
 * Creates a runs row, runs the agent end to end, and writes an agent_events
 * row for every step (SPEC.md sections 3 and 10). runId is generated here
 * (not left to the DB default) so it's available synchronously, before the
 * INSERT completes — callers (the CLI, the SSE route) need it immediately.
 */
export function startRun(options: StartRunOptions): RunHandle {
  const runId = randomUUID();
  const queue = new AsyncEventQueue();
  const unsubscribe = subscribeToRun(runId, (event) => queue.push(event));

  const done: Promise<RunOutcome> = (async () => {
    try {
      await createRun({
        id: runId,
        mode: options.mode,
        pack: options.pack,
        model: process.env.AGENT_MODEL ?? "unknown",
      });
      await emitEvent({ runId, kind: "run_started", payload: { mode: options.mode, pack: options.pack } });

      const summary = await runAgent({ runId, mode: options.mode, pack: options.pack });

      await emitEvent({ runId, kind: "run_finished", payload: { status: "completed", summary } });
      await finishRun(runId, summary, {});
      return { status: "completed" as const, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await emitEvent({ runId, kind: "error", payload: { message } });
      await emitEvent({ runId, kind: "run_finished", payload: { status: "failed", error: message } });
      await finishRun(runId, null, { error: message });
      return { status: "failed" as const, summary: null };
    } finally {
      queue.close();
      unsubscribe();
    }
  })();

  return { runId, events: queue, done };
}
