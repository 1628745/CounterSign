#!/usr/bin/env tsx
// npm run demo:reset — demo mode only (SPEC.md section 6). Sweeps every
// non-treasury mUSDC balance back to the treasury, deletes non-history rows
// from Tiger Data (keeping the seed), restores vendor_notes to the verified
// addresses, and refreshes both continuous aggregates.

import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "../src/lib/db/client";
import { explorerTxUrl } from "../src/lib/solana/explorer";
import { sweepToTreasury } from "../src/lib/solana/signer";

async function main(): Promise<void> {
  if (process.env.DEMO_MODE !== "true") {
    console.error("DEMO_MODE is not 'true' — refusing to run demo:reset.");
    process.exit(1);
  }

  console.log("-- sweeping non-treasury mUSDC balances back to treasury --");
  const swept = await sweepToTreasury();
  if (swept.length === 0) {
    console.log("nothing to sweep — every non-treasury wallet is already at 0 mUSDC.");
  } else {
    for (const s of swept) {
      console.log(`${s.wallet}: ${s.amountMicros} micros -> treasury. ${explorerTxUrl(s.signature)}`);
    }
  }

  console.log("\n-- resetting Tiger Data to the seed --");
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
  console.log("cleared non-history payments/runs/events/approvals/eval_results; vendor_notes restored to verified addresses.");

  console.log("\n-- refreshing continuous aggregates --");
  await sql`CALL refresh_continuous_aggregate('vendor_spend_daily', NULL, NULL)`;
  await sql`CALL refresh_continuous_aggregate('spend_by_minute', NULL, NULL)`;

  console.log("\nDone.");
  await sql.end();
}

main().catch((error) => {
  console.error("demo:reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
