import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import type { Mode } from "@/lib/pipeline";
import { startRun } from "@/lib/runs";

/**
 * POST /api/runs {mode, pack} — starts a run and streams its agent_events
 * as SSE. Events are always persisted to Tiger Data before being enqueued
 * onto this stream (write-then-show, SPEC.md section 3/14 #3) via
 * src/lib/runs's event bus. Needs a session (SPEC.md section 9/10) —
 * src/proxy.ts already protects this route, this is a defensive
 * belt-and-suspenders check.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const mode = body?.mode as Mode | undefined;
  const pack = body?.pack as string | undefined;
  if (mode !== "naive" && mode !== "guarded") {
    return NextResponse.json({ error: "mode must be 'naive' or 'guarded'" }, { status: 400 });
  }
  if (!pack || typeof pack !== "string") {
    return NextResponse.json({ error: "pack is required" }, { status: 400 });
  }

  const handle = startRun({ mode, pack });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: run_id\ndata: ${JSON.stringify({ runId: handle.runId })}\n\n`));
      try {
        for await (const event of handle.events) {
          const serializable = { ...event, seq: event.seq.toString() };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(serializable)}\n\n`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-run-id": handle.runId,
    },
  });
}
