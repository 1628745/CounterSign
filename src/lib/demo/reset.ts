import { getDb } from "@/lib/db/client";
import { sweepToTreasury, type SweepResult } from "@/lib/solana/signer";

export interface DemoResetResult {
  swept: SweepResult[];
}

/**
 * Shared demo-reset logic (SPEC.md section 6/10): sweeps every non-treasury
 * mUSDC balance back to the treasury, deletes non-history rows from Tiger
 * Data, restores vendor_notes to the verified addresses, and refreshes both
 * continuous aggregates. Extracted from scripts/demo-reset.ts (which now
 * just calls this and prints) so POST /api/demo/reset — needed for Mission
 * Control's "Reset demo" button, docs/DESIGN.md section A6 — can call the
 * exact same logic instead of a second copy, the same pattern already used
 * by advancePendingApprovals() (src/lib/countersign/approvals.ts) for the
 * CLI/API split. Behavior is unchanged from the original script.
 */
export async function resetDemo(): Promise<DemoResetResult> {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("DEMO_MODE is not 'true' — refusing to run demo reset.");
  }

  const swept = await sweepToTreasury();

  const sql = getDb();
  await sql.begin(async (tx) => {
    await tx`DELETE FROM risk_evaluations`;
    await tx`DELETE FROM vendor_detail_changes`;
    await tx`DELETE FROM agent_events`;
    await tx`DELETE FROM approvals`;
    await tx`DELETE FROM eval_results`;
    await tx`DELETE FROM payments WHERE mode != 'history'`;
    await tx`DELETE FROM runs`;
    await tx`
      UPDATE vendor_notes vn
      SET payout_address = v.verified_address, updated_at = now(), updated_from_email = NULL
      FROM vendors v
      WHERE vn.vendor_id = v.id
    `;
  });

  await sql`CALL refresh_continuous_aggregate('vendor_spend_daily', NULL, NULL)`;
  await sql`CALL refresh_continuous_aggregate('spend_by_minute', NULL, NULL)`;

  return { swept };
}
