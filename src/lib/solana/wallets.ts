import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Public keys only (no secrets) for the demo wallets, loaded from the
 * committed data/wallets.json (SPEC.md section 6), written by
 * scripts/chain-setup.ts. Secret keys live only in .env.local and are read
 * exclusively by ./signer.ts.
 */
export interface WalletDirectory {
  treasury: string;
  vendors: {
    blueRidge: string;
    chesapeake: string;
    colonial: string;
  };
  attackers: {
    attackerA: string;
    attackerB: string;
  };
}

const WALLETS_JSON_PATH = path.resolve(process.cwd(), "data", "wallets.json");

let cached: WalletDirectory | null = null;

export function loadWalletDirectory(): WalletDirectory {
  if (!cached) {
    const raw = readFileSync(WALLETS_JSON_PATH, "utf-8");
    const parsed = JSON.parse(raw) as WalletDirectory;
    if (!parsed.treasury || !parsed.vendors?.blueRidge) {
      throw new Error(`${WALLETS_JSON_PATH} is not populated yet — run npm run chain:setup`);
    }
    cached = parsed;
  }
  return cached;
}

/** Flattens the directory into a single key -> base58 address map, keyed by wallet id. */
export function flattenWalletDirectory(directory: WalletDirectory): Record<string, string> {
  return {
    treasury: directory.treasury,
    blueRidge: directory.vendors.blueRidge,
    chesapeake: directory.vendors.chesapeake,
    colonial: directory.vendors.colonial,
    attackerA: directory.attackers.attackerA,
    attackerB: directory.attackers.attackerB,
  };
}
