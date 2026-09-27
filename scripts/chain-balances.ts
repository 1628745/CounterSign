#!/usr/bin/env tsx
// npm run chain:balances — prints SOL and mUSDC balances for all six demo wallets (SPEC.md section 6).

import { config } from "dotenv";
config({ path: ".env.local" });

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAllBalances } from "../src/lib/solana/balances";

const MINT_DECIMALS = 6;

function formatMusdc(micros: bigint): string {
  const sign = micros < 0n ? "-" : "";
  const abs = micros < 0n ? -micros : micros;
  const whole = abs / 10n ** BigInt(MINT_DECIMALS);
  const frac = (abs % 10n ** BigInt(MINT_DECIMALS)).toString().padStart(MINT_DECIMALS, "0");
  return `${sign}${whole}.${frac}`;
}

async function main(): Promise<void> {
  const balances = await getAllBalances(true);

  const rows = Object.entries(balances).map(([key, b]) => ({
    wallet: key,
    address: b.address,
    sol: (b.solLamports / LAMPORTS_PER_SOL).toFixed(4),
    musdc: formatMusdc(b.musdcMicros),
  }));

  const widths = {
    wallet: Math.max(6, ...rows.map((r) => r.wallet.length)),
    address: Math.max(7, ...rows.map((r) => r.address.length)),
    sol: Math.max(3, ...rows.map((r) => r.sol.length)),
    musdc: Math.max(5, ...rows.map((r) => r.musdc.length)),
  };

  const header = `${"wallet".padEnd(widths.wallet)}  ${"address".padEnd(widths.address)}  ${"SOL".padStart(widths.sol)}  ${"mUSDC".padStart(widths.musdc)}`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    console.log(
      `${row.wallet.padEnd(widths.wallet)}  ${row.address.padEnd(widths.address)}  ${row.sol.padStart(widths.sol)}  ${row.musdc.padStart(widths.musdc)}`,
    );
  }
}

main().catch((error) => {
  console.error("chain:balances failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
