#!/usr/bin/env tsx
// npm run db:seed — loads vendors (verified addresses from data/wallets.json),
// vendor_notes, ~90 days of realistic vendor history (incl. the INV-BR-4388
// duplicate), and the E1-E8 demo inbox. Refreshes both continuous
// aggregates afterward. Re-runnable: clears prior seed rows first.
// SPEC.md section 2 and 5.

import { config } from "dotenv";
config({ path: ".env.local" });

import demoScenario from "../data/scenarios/demo.json";
import { getDb } from "../src/lib/db/client";
import { insertPayment } from "../src/lib/db/queries/payments";
import { loadWalletDirectory } from "../src/lib/solana/wallets";

const MINT_DECIMALS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function dollarsToMicros(dollars: number): bigint {
  return BigInt(Math.round(dollars * 10 ** MINT_DECIMALS));
}

interface VendorSpec {
  id: string;
  name: string;
  domain: string;
  verifiedAddress: string;
  verificationMethod: string;
}

interface HistoryEntry {
  ts: Date;
  invoiceNumber: string;
  amountMicros: bigint;
}

/**
 * Walks backward in time from an anchor (most recent) invoice, decrementing
 * the invoice number each step and jittering cadence/amount, until it
 * passes horizonDays. Returned in chronological (oldest-first) order.
 */
function generateHistory(opts: {
  prefix: string;
  anchorInvoiceNumber: number;
  anchorDaysAgo: number;
  cadenceDays: number;
  cadenceJitterDays: number;
  minAmount: number;
  maxAmount: number;
  horizonDays: number;
  now: Date;
}): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let ts = new Date(opts.now.getTime() - opts.anchorDaysAgo * DAY_MS);
  let invoiceNumber = opts.anchorInvoiceNumber;
  const horizonMs = opts.horizonDays * DAY_MS;

  while (opts.now.getTime() - ts.getTime() <= horizonMs) {
    const amount = opts.minAmount + Math.random() * (opts.maxAmount - opts.minAmount);
    entries.push({
      ts: new Date(ts),
      invoiceNumber: `${opts.prefix}${invoiceNumber}`,
      amountMicros: dollarsToMicros(Math.round(amount * 100) / 100),
    });
    invoiceNumber -= 1;
    const cadence = Math.max(1, opts.cadenceDays + (Math.random() * 2 - 1) * opts.cadenceJitterDays);
    ts = new Date(ts.getTime() - cadence * DAY_MS);
  }
  return entries.reverse();
}

async function main(): Promise<void> {
  const now = new Date();
  const wallets = loadWalletDirectory();
  const sql = getDb();

  const vendors: VendorSpec[] = [
    {
      id: "blueridge",
      name: "Blue Ridge Green Coffee Importers",
      domain: "blueridgegreencoffee.com",
      verifiedAddress: wallets.vendors.blueRidge,
      verificationMethod: "phone_verification",
    },
    {
      id: "chesapeake",
      name: "Chesapeake Dairy Supply",
      domain: "chesapeakedairy.com",
      verifiedAddress: wallets.vendors.chesapeake,
      verificationMethod: "phone_verification",
    },
    {
      id: "colonial",
      name: "Colonial Paper & Packaging",
      domain: "colonialpaperpack.com",
      verifiedAddress: wallets.vendors.colonial,
      verificationMethod: "phone_verification",
    },
  ];

  console.log("-- clearing prior seed rows (idempotent re-seed) --");
  await sql.begin(async (tx) => {
    await tx`DELETE FROM payments WHERE mode = 'history'`;
    await tx`DELETE FROM inbox_emails WHERE pack = 'demo'`;
    await tx`DELETE FROM vendor_notes`;
    await tx`DELETE FROM vendors`;
  });

  console.log("-- vendors + vendor_notes --");
  const verifiedAt = new Date(now.getTime() - 400 * DAY_MS);
  await sql.begin(async (tx) => {
    for (const v of vendors) {
      await tx`
        INSERT INTO vendors (id, name, domain, verified_address, verified_at, verification_method)
        VALUES (${v.id}, ${v.name}, ${v.domain}, ${v.verifiedAddress}, ${verifiedAt}, ${v.verificationMethod})
      `;
      await tx`
        INSERT INTO vendor_notes (vendor_id, payout_address, updated_at, updated_from_email)
        VALUES (${v.id}, ${v.verifiedAddress}, ${verifiedAt}, NULL)
      `;
      console.log(`  ${v.name} -> ${v.verifiedAddress}`);
    }
  });

  console.log("\n-- demo inbox (E1-E8) --");
  const baseline = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  await sql.begin(async (tx) => {
    for (const email of demoScenario.emails) {
      const receivedAt = new Date(baseline.getTime() + (email.position - 1) * 30 * 60 * 1000);
      await tx`
        INSERT INTO inbox_emails (id, pack, "position", from_name, from_address, subject, html, received_at)
        VALUES (${email.id}, ${demoScenario.pack}, ${email.position}, ${email.from_name}, ${email.from_address}, ${email.subject}, ${email.html}, ${receivedAt})
      `;
      console.log(`  ${email.id}: ${email.subject}`);
    }
  });

  console.log("\n-- ~90 days of vendor history --");
  const histories: Record<string, HistoryEntry[]> = {
    // Anchor exactly 6 days ago at INV-BR-4388 / $2,115.00 — this is the row
    // E8 duplicates (SPEC.md section 2).
    blueridge: generateHistory({
      prefix: "INV-BR-",
      anchorInvoiceNumber: 4388,
      anchorDaysAgo: 6,
      cadenceDays: 7,
      cadenceJitterDays: 1.5,
      minAmount: 1800,
      maxAmount: 2600,
      horizonDays: 90,
      now,
    }),
    chesapeake: generateHistory({
      prefix: "INV-CD-",
      anchorInvoiceNumber: 2288,
      anchorDaysAgo: 3,
      cadenceDays: 3.5,
      cadenceJitterDays: 0.75,
      minAmount: 300,
      maxAmount: 520,
      horizonDays: 90,
      now,
    }),
    colonial: generateHistory({
      prefix: "INV-CP-",
      anchorInvoiceNumber: 7712,
      anchorDaysAgo: 9,
      cadenceDays: 14,
      cadenceJitterDays: 2,
      minAmount: 600,
      maxAmount: 900,
      horizonDays: 90,
      now,
    }),
  };
  // Force the exact anchor amount for the Blue Ridge duplicate row — the
  // walk above randomizes amount even for the anchor invoice number/date.
  const blueRidgeHistory = histories.blueridge;
  blueRidgeHistory[blueRidgeHistory.length - 1].amountMicros = dollarsToMicros(2115.0);

  for (const vendor of vendors) {
    const entries = histories[vendor.id];
    for (const entry of entries) {
      await insertPayment({
        ts: entry.ts,
        mode: "history",
        vendorId: vendor.id,
        payeeAddress: vendor.verifiedAddress,
        amountMicros: entry.amountMicros,
        invoiceNumber: entry.invoiceNumber,
        sourceEmailId: null,
        decision: "history",
        txStatus: "none",
      });
    }
    console.log(`  ${vendor.name}: ${entries.length} historical payments`);
  }

  console.log("\n-- refreshing continuous aggregates --");
  await sql`CALL refresh_continuous_aggregate('vendor_spend_daily', NULL, NULL)`;
  await sql`CALL refresh_continuous_aggregate('spend_by_minute', NULL, NULL)`;

  console.log("\nDone.");
  await sql.end();
}

main().catch((error) => {
  console.error("db:seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
