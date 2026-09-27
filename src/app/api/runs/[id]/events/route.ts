import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { getDb } from "@/lib/db/client";

interface EventDbRow {
  seq: string;
  kind: string;
  email_id: string | null;
  payment_id: string | null;
  payload: unknown;
  ts: Date;
}

/**
 * GET /api/runs/[id]/events?after=seq — returns agent_events for a run
 * after the given seq, for replay or polling (SPEC.md section 10). Needs a
 * session; src/proxy.ts already protects this route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const afterParam = url.searchParams.get("after");
  const after = afterParam ?? "-1";

  const sql = getDb();
  const rows = await sql<EventDbRow[]>`
    SELECT seq, kind, email_id, payment_id, payload, ts
    FROM agent_events
    WHERE run_id = ${id} AND seq > ${after}
    ORDER BY seq ASC
  `;

  return NextResponse.json({
    events: rows.map((row) => ({
      seq: String(row.seq),
      kind: row.kind,
      emailId: row.email_id,
      paymentId: row.payment_id,
      payload: row.payload,
      ts: row.ts,
    })),
  });
}
