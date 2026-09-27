import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { advancePendingApprovals } from "@/lib/countersign/approvals";

/**
 * POST /api/approvals/poll — advances every approval whose next_poll_at
 * has passed (SPEC.md section 10). Thin wrapper around the shared
 * advancePendingApprovals(), also used by scripts/run-agent.ts's guarded
 * CLI wait loop. Needs a session; src/proxy.ts already protects this route.
 */
export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const advances = await advancePendingApprovals();
  return NextResponse.json({ advances });
}
