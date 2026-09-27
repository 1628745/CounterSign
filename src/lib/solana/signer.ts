import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import { getLatestApprovalForPayment } from "@/lib/db/queries/approvals";
import { getPaymentById } from "@/lib/db/queries/payments";
import { emitEvent } from "@/lib/runs/eventBus";
import { getConnection } from "./connection";
import { buildMemo } from "./memo";

/**
 * THE ONLY MODULE ALLOWED TO LOAD SECRET KEYS (SPEC.md section 3 and
 * non-negotiable #1). Nothing under src/lib/agent/** may import this file
 * or read any *_SECRET_KEY env var directly — enforced by
 * eslint.config.mjs and tests/agent-isolation.test.ts.
 */

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const MINT_DECIMALS = 6;

const NON_TREASURY_SECRET_ENV: Record<string, string> = {
  blueRidge: "VENDOR_BLUERIDGE_SECRET_KEY",
  chesapeake: "VENDOR_CHESAPEAKE_SECRET_KEY",
  colonial: "VENDOR_COLONIAL_SECRET_KEY",
  attackerA: "ATTACKER_A_SECRET_KEY",
  attackerB: "ATTACKER_B_SECRET_KEY",
};

function keypairFromEnv(name: string): Keypair {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — run npm run chain:setup`);
  }
  return Keypair.fromSecretKey(bs58.decode(value));
}

function loadTreasury(): Keypair {
  return keypairFromEnv("TREASURY_SECRET_KEY");
}

function requireMint(): PublicKey {
  const mint = process.env.MUSDC_MINT;
  if (!mint) {
    throw new Error("MUSDC_MINT is not set — run npm run chain:setup");
  }
  return new PublicKey(mint);
}

/**
 * transferChecked + Memo instruction, simulated before sending, confirmed
 * at 'confirmed' (SPEC.md section 6). `feePayer` pays fees; `sourceOwner`
 * signs the transfer out of its own associated token account.
 */
async function memoTransfer(
  connection: Connection,
  feePayer: Keypair,
  sourceOwner: Keypair,
  destination: PublicKey,
  amountMicros: bigint,
  memo: string,
): Promise<string> {
  const mint = requireMint();
  const sourceAta = getAssociatedTokenAddressSync(mint, sourceOwner.publicKey);
  const destinationAta = getAssociatedTokenAddressSync(mint, destination);

  const transaction = new Transaction().add(
    createTransferCheckedInstruction(sourceAta, mint, destinationAta, sourceOwner.publicKey, amountMicros, MINT_DECIMALS),
    new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, "utf-8") }),
  );
  transaction.feePayer = feePayer.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signers = feePayer.publicKey.equals(sourceOwner.publicKey) ? [feePayer] : [feePayer, sourceOwner];

  const simulation = await connection.simulateTransaction(transaction, signers);
  if (simulation.value.err) {
    throw new Error(
      `simulateTransaction failed: ${JSON.stringify(simulation.value.err)} logs=${simulation.value.logs?.join(" | ") ?? ""}`,
    );
  }

  return sendAndConfirmTransaction(connection, transaction, signers, { commitment: "confirmed" });
}

/**
 * Re-reads the payment and its decision from Tiger Data and refuses unless:
 * decision = auto_pay; or decision = approved with a stored, verified Auth0
 * approval; or mode = naive (SPEC.md section 6).
 */
export async function executePayment(paymentId: string): Promise<{ signature: string }> {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error(`No payment found for id ${paymentId}`);
  }

  async function refuse(reason: string): Promise<never> {
    if (payment && payment.runId) {
      await emitEvent({
        runId: payment.runId,
        kind: "error",
        paymentId,
        payload: { tool: "signer.executePayment", refused: true, reason },
      });
    }
    throw new Error(`Refusing to pay ${paymentId}: ${reason}`);
  }

  let authReqId: string | undefined;
  if (payment.mode === "naive") {
    // Naive mode bypasses the gateway entirely — no decision gate.
  } else if (payment.decision === "auto_pay") {
    // ok
  } else if (payment.decision === "approved") {
    const approval = await getLatestApprovalForPayment(paymentId);
    if (!approval || approval.status !== "approved" || !approval.tokenFingerprint) {
      await refuse("decision is 'approved' but no stored, verified approval record (with a token fingerprint) was found");
    }
    authReqId = approval!.authReqId;
  } else {
    await refuse(`decision is '${payment.decision}' (must be auto_pay, approved with a verified approval, or mode=naive)`);
  }

  const connection = getConnection();
  const treasury = loadTreasury();
  const memo = buildMemo({ paymentId, decision: payment.decision, riskScore: payment.riskScore ?? 0, authReqId });

  const signature = await memoTransfer(
    connection,
    treasury,
    treasury,
    new PublicKey(payment.payeeAddress),
    payment.amountMicros,
    memo,
  );
  return { signature };
}

export interface SweepResult {
  wallet: string;
  signature: string;
  amountMicros: bigint;
}

/**
 * demo:reset support: sweeps every non-treasury wallet's mUSDC balance back
 * to the treasury. Owners sign their own transfer; the treasury pays fees
 * (SPEC.md section 6).
 */
export async function sweepToTreasury(): Promise<SweepResult[]> {
  const connection = getConnection();
  const treasury = loadTreasury();
  const mint = requireMint();
  const results: SweepResult[] = [];

  for (const [wallet, envVar] of Object.entries(NON_TREASURY_SECRET_ENV)) {
    const owner = keypairFromEnv(envVar);
    const ata = getAssociatedTokenAddressSync(mint, owner.publicKey);
    const account = await getAccount(connection, ata);
    if (account.amount === 0n) {
      continue;
    }
    const memo = "countersign:v1|pay=demoreset|dec=sweep|risk=0|appr=none";
    const signature = await memoTransfer(connection, treasury, owner, treasury.publicKey, account.amount, memo);
    results.push({ wallet, signature, amountMicros: account.amount });
  }
  return results;
}
