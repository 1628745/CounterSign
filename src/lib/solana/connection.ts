import { Connection } from "@solana/web3.js";

/**
 * Shared devnet Connection. Refuses to run if SOLANA_RPC_URL contains
 * "mainnet" (SPEC.md section 6, non-negotiable #5 — devnet only).
 *
 * TODO(solana prompt): implement caching/reuse across calls.
 */
export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "";
  if (rpcUrl.toLowerCase().includes("mainnet")) {
    throw new Error("Refusing to connect: SOLANA_RPC_URL contains 'mainnet'. Devnet only (SPEC.md section 6).");
  }
  throw new Error("TODO: implement getConnection — see SPEC.md section 6");
}
