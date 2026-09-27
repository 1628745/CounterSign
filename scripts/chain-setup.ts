#!/usr/bin/env tsx
// npm run chain:setup — idempotent Solana devnet setup (SPEC.md section 6).
// Run 1: generates the six wallets (if missing) and stops, asking you to
// fund the treasury from the devnet faucet. Run 2+ (after funding): creates
// the mUSDC mint, associated token accounts, and mints 250,000 to treasury.

import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import bs58 from "bs58";

const ENV_LOCAL = path.resolve(__dirname, "..", ".env.local");
const WALLETS_JSON = path.resolve(__dirname, "..", "data", "wallets.json");
const MINT_DECIMALS = 6;
const TREASURY_MINT_AMOUNT = 250_000;
// Enough to cover mint + ATA rent + a handful of tx fees. The faucet gives
// ~1-2 SOL per request; ~2 SOL is comfortable headroom for the whole demo.
const MIN_TREASURY_SOL_TO_PROCEED = 0.1;
const RECOMMENDED_TREASURY_SOL = 2;

interface WalletSpec {
  envVar: string;
  label: string;
}

const WALLET_SPECS: Record<string, WalletSpec> = {
  treasury: { envVar: "TREASURY_SECRET_KEY", label: "Treasury" },
  blueRidge: { envVar: "VENDOR_BLUERIDGE_SECRET_KEY", label: "Blue Ridge Green Coffee Importers" },
  chesapeake: { envVar: "VENDOR_CHESAPEAKE_SECRET_KEY", label: "Chesapeake Dairy Supply" },
  colonial: { envVar: "VENDOR_COLONIAL_SECRET_KEY", label: "Colonial Paper & Packaging" },
  attackerA: { envVar: "ATTACKER_A_SECRET_KEY", label: "Attacker A" },
  attackerB: { envVar: "ATTACKER_B_SECRET_KEY", label: "Attacker B" },
};

function readEnvLocal(): string {
  return existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, "utf-8") : "";
}

function readEnvVar(name: string): string | undefined {
  const match = readEnvLocal().match(new RegExp(`^${name}=(.*)$`, "m"));
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Writes/replaces a var in .env.local. Never prints the value. */
function setEnvVar(name: string, value: string, label = name): void {
  let content = readEnvLocal();
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content += (content.length > 0 && !content.endsWith("\n") ? "\n" : "") + line + "\n";
  }
  writeFileSync(ENV_LOCAL, content);
  console.log(`  -> wrote ${label} to .env.local`);
}

function loadOrCreateKeypair(spec: WalletSpec): { keypair: Keypair; created: boolean } {
  const existing = readEnvVar(spec.envVar);
  if (existing) {
    return { keypair: Keypair.fromSecretKey(bs58.decode(existing)), created: false };
  }
  const keypair = Keypair.generate();
  setEnvVar(spec.envVar, bs58.encode(keypair.secretKey), spec.label);
  return { keypair, created: true };
}

async function main(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "";
  if (!rpcUrl) {
    console.error("SOLANA_RPC_URL is not set — see .env.example");
    process.exit(1);
  }
  if (rpcUrl.toLowerCase().includes("mainnet")) {
    console.error(`Refusing to run: SOLANA_RPC_URL contains "mainnet". Devnet only (SPEC.md section 6/14).`);
    process.exit(1);
  }
  const connection = new Connection(rpcUrl, "confirmed");

  console.log("Countersign chain setup\n");
  console.log("-- wallets --");
  const keypairs: Record<string, Keypair> = {};
  for (const [key, spec] of Object.entries(WALLET_SPECS)) {
    const { keypair, created } = loadOrCreateKeypair(spec);
    keypairs[key] = keypair;
    console.log(`${created ? "created" : "loaded "} ${spec.label.padEnd(32)} ${keypair.publicKey.toBase58()}`);
  }

  const walletDirectory = {
    treasury: keypairs.treasury.publicKey.toBase58(),
    vendors: {
      blueRidge: keypairs.blueRidge.publicKey.toBase58(),
      chesapeake: keypairs.chesapeake.publicKey.toBase58(),
      colonial: keypairs.colonial.publicKey.toBase58(),
    },
    attackers: {
      attackerA: keypairs.attackerA.publicKey.toBase58(),
      attackerB: keypairs.attackerB.publicKey.toBase58(),
    },
  };
  writeFileSync(WALLETS_JSON, JSON.stringify(walletDirectory, null, 2) + "\n");
  console.log(`\nWrote public keys to ${path.relative(process.cwd(), WALLETS_JSON)}`);

  const treasury = keypairs.treasury;
  console.log("\n-- treasury balance --");
  const balanceLamports = await connection.getBalance(treasury.publicKey);
  const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
  console.log(`${treasury.publicKey.toBase58()}: ${balanceSol} SOL`);

  if (balanceSol < MIN_TREASURY_SOL_TO_PROCEED) {
    console.log(`\nSTOP: fund the treasury with ~${RECOMMENDED_TREASURY_SOL} SOL from the devnet faucet, then say`);
    console.log(`done and re-run \`npm run chain:setup\`.\n`);
    console.log(`  Treasury address: ${treasury.publicKey.toBase58()}`);
    console.log(`  Faucet:           https://faucet.solana.com/ (select Devnet)`);
    process.exit(0);
  }
  if (balanceSol < RECOMMENDED_TREASURY_SOL) {
    console.log(`(below the recommended ~${RECOMMENDED_TREASURY_SOL} SOL, but enough to proceed — top up more before a long demo run)`);
  }

  console.log("\n-- mUSDC mint --");
  let mint: PublicKey;
  const existingMint = process.env.MUSDC_MINT;
  if (existingMint) {
    mint = new PublicKey(existingMint);
    console.log(`already exists: ${mint.toBase58()}`);
  } else {
    mint = await createMint(connection, treasury, treasury.publicKey, null, MINT_DECIMALS);
    setEnvVar("MUSDC_MINT", mint.toBase58(), "MUSDC_MINT");
    console.log(`created: ${mint.toBase58()} (${MINT_DECIMALS} decimals, mint authority = treasury)`);
  }

  console.log("\n-- associated token accounts (treasury pays rent) --");
  const atas: Record<string, PublicKey> = {};
  for (const [key, keypair] of Object.entries(keypairs)) {
    const account = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, keypair.publicKey);
    atas[key] = account.address;
    console.log(`${key.padEnd(12)} ${account.address.toBase58()}`);
  }

  console.log("\n-- treasury mUSDC supply --");
  const targetAmount = BigInt(TREASURY_MINT_AMOUNT) * 10n ** BigInt(MINT_DECIMALS);
  const treasuryAccount = await getAccount(connection, atas.treasury);
  if (treasuryAccount.amount >= targetAmount) {
    console.log(`treasury already holds ${Number(treasuryAccount.amount) / 10 ** MINT_DECIMALS} mUSDC — skipping mint.`);
  } else {
    const signature = await mintTo(connection, treasury, mint, atas.treasury, treasury, targetAmount);
    console.log(`minted ${TREASURY_MINT_AMOUNT} mUSDC to treasury. tx: ${signature}`);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("chain:setup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
