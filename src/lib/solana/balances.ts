import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection } from "./connection";
import { flattenWalletDirectory, loadWalletDirectory } from "./wallets";

export interface WalletBalance {
  address: string;
  solLamports: number;
  /** Money is bigint micro-units everywhere (SPEC.md section 14, #4); format only in the UI. */
  musdcMicros: bigint;
}

export type Balances = Record<string, WalletBalance>;

const CACHE_MS = 3000;
let cache: { data: Balances; expiresAt: number } | null = null;

function requireMint(): PublicKey {
  const mint = process.env.MUSDC_MINT;
  if (!mint) {
    throw new Error("MUSDC_MINT is not set — run npm run chain:setup");
  }
  return new PublicKey(mint);
}

/**
 * Balances for all six demo wallets. Fetches SOL (fee headroom) and mUSDC in
 * two batched RPC calls total — one getMultipleAccountsInfo for SOL, one
 * getMultipleParsedAccounts for every associated token account (SPEC.md
 * section 6) — cached for ~3s.
 */
export async function getAllBalances(forceRefresh = false): Promise<Balances> {
  if (!forceRefresh && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const connection = getConnection();
  const mint = requireMint();
  const flat = flattenWalletDirectory(loadWalletDirectory());
  const keys = Object.keys(flat);
  const owners = keys.map((key) => new PublicKey(flat[key]));
  const atas = owners.map((owner) => getAssociatedTokenAddressSync(mint, owner));

  const [ownerAccounts, tokenAccounts] = await Promise.all([
    connection.getMultipleAccountsInfo(owners),
    connection.getMultipleParsedAccounts(atas),
  ]);

  const data: Balances = {};
  keys.forEach((key, i) => {
    const solLamports = ownerAccounts[i]?.lamports ?? 0;
    const parsedData = tokenAccounts.value[i]?.data;
    const musdcMicros =
      parsedData && "parsed" in parsedData ? BigInt(parsedData.parsed.info.tokenAmount.amount) : 0n;
    data[key] = { address: flat[key], solLamports, musdcMicros };
  });

  cache = { data, expiresAt: Date.now() + CACHE_MS };
  return data;
}
