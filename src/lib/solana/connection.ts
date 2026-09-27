import { Connection } from "@solana/web3.js";

/**
 * Shared devnet Connection. Refuses to run if SOLANA_RPC_URL contains
 * "mainnet" (SPEC.md section 6, non-negotiable #5 — devnet only).
 */
let cached: Connection | null = null;

export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "";
  if (!rpcUrl) {
    throw new Error("SOLANA_RPC_URL is not set — see .env.example");
  }
  if (rpcUrl.toLowerCase().includes("mainnet")) {
    throw new Error('Refusing to connect: SOLANA_RPC_URL contains "mainnet". Devnet only (SPEC.md section 6/14).');
  }
  if (!cached) {
    cached = new Connection(rpcUrl, "confirmed");
  }
  return cached;
}
