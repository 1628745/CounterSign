#!/usr/bin/env tsx
// npm run demo:reset — demo mode only (SPEC.md section 6). Thin CLI wrapper
// around src/lib/demo/reset.ts's resetDemo(), shared with POST
// /api/demo/reset (Mission Control's "Reset demo" button) the same way
// advancePendingApprovals() is shared between the CLI and the API.

import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "../src/lib/db/client";
import { resetDemo } from "../src/lib/demo/reset";
import { explorerTxUrl } from "../src/lib/solana/explorer";

async function main(): Promise<void> {
  console.log("-- sweeping non-treasury mUSDC balances back to treasury --");
  console.log("-- resetting Tiger Data to the seed --");
  console.log("-- refreshing continuous aggregates --");

  const { swept } = await resetDemo();

  if (swept.length === 0) {
    console.log("nothing to sweep — every non-treasury wallet is already at 0 mUSDC.");
  } else {
    for (const s of swept) {
      console.log(`${s.wallet}: ${s.amountMicros} micros -> treasury. ${explorerTxUrl(s.signature)}`);
    }
  }
  console.log("cleared non-history payments/runs/events/approvals/eval_results; vendor_notes restored to verified addresses.");
  console.log("\nDone.");

  const sql = getDb();
  await sql.end();
}

main().catch((error) => {
  console.error("demo:reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
