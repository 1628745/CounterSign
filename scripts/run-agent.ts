#!/usr/bin/env tsx
// npm run agent -- --mode naive|guarded --pack demo — runs the AP agent
// from the terminal with a readable, colorized one-line-per-event trace.
// In guarded mode, once the agent finishes, polls
// advancePendingApprovals() every 2s and prints state changes until every
// approval is resolved or expired. Ends with a summary table (SPEC.md
// sections 7, 9, 10, 12) — decision/score/top-reason columns in guarded mode.

import { config } from "dotenv";
config({ path: ".env.local" });

import { advancePendingApprovals } from "../src/lib/countersign/approvals";
import { getDb } from "../src/lib/db/client";
import type { Mode } from "../src/lib/pipeline";
import { startRun } from "../src/lib/runs";
import type { PersistedEvent } from "../src/lib/runs/eventBus";
import { explorerTxUrl } from "../src/lib/solana/explorer";
import { flattenWalletDirectory, loadWalletDirectory } from "../src/lib/solana/wallets";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function color(code: keyof typeof COLORS, text: string): string {
  return `${COLORS[code]}${text}${COLORS.reset}`;
}

const KIND_COLOR: Record<string, keyof typeof COLORS> = {
  run_started: "cyan",
  run_finished: "cyan",
  email_read: "blue",
  tool_call: "gray",
  tool_result: "gray",
  agent_message: "reset",
  vendor_change: "yellow",
  payment_proposed: "magenta",
  risk_scored: "magenta",
  approval_requested: "magenta",
  approval_resolved: "magenta",
  tx_submitted: "magenta",
  tx_confirmed: "green",
  payment_blocked: "red",
  error: "red",
};

const STATUS_COLOR: Record<string, keyof typeof COLORS> = {
  pending: "yellow",
  approved: "green",
  denied: "red",
  expired: "red",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): { mode: string; pack: string } {
  let mode = "naive";
  let pack = "demo";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--mode") mode = argv[++i] ?? mode;
    else if (argv[i] === "--pack") pack = argv[++i] ?? pack;
  }
  return { mode, pack };
}

function formatPayload(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return json.length > 140 ? `${json.slice(0, 140)}…` : json;
}

function formatEvent(event: PersistedEvent, startedAt: number): string {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2).padStart(6, " ");
  const kindColor = KIND_COLOR[event.kind] ?? "reset";
  const kind = color(kindColor, event.kind.padEnd(18, " "));
  return `${color("dim", `[${elapsed}s]`)} ${kind} ${formatPayload(event.payload)}`;
}

async function countPendingApprovalsForRun(runId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ count: string }[]>`
    SELECT count(*) FROM approvals a
    JOIN payments p ON p.payment_id = a.payment_id
    WHERE p.run_id = ${runId} AND a.status = 'pending'
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Guarded-mode wait loop: while any approval for this run is still
 * pending, calls the shared advancePendingApprovals() every 2s and prints
 * each state change, until every approval is resolved or expired.
 */
async function waitForApprovals(runId: string, startedAt: number): Promise<void> {
  const lastStatus = new Map<string, string>();

  while (true) {
    const pending = await countPendingApprovalsForRun(runId);
    if (pending === 0) return;

    const advances = await advancePendingApprovals();
    for (const advance of advances) {
      if (lastStatus.get(advance.approvalId) === advance.status) continue;
      lastStatus.set(advance.approvalId, advance.status);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2).padStart(6, " ");
      const statusColor = STATUS_COLOR[advance.status] ?? "reset";
      const sigPart = advance.signature ? ` ${explorerTxUrl(advance.signature)}` : "";
      console.log(`${color("dim", `[${elapsed}s]`)} ${color("magenta", "approval_poll".padEnd(18))} ${advance.paymentId.slice(0, 8)} -> ${color(statusColor, advance.status)}${sigPart}`);
    }

    await sleep(2000);
  }
}

async function main(): Promise<void> {
  const { mode, pack } = parseArgs(process.argv.slice(2));
  if (mode !== "naive" && mode !== "guarded") {
    console.error(`--mode must be "naive" or "guarded", got "${mode}"`);
    process.exit(1);
  }

  console.log(color("bold", `Countersign agent — mode=${mode} pack=${pack}\n`));

  const startedAt = Date.now();
  const handle = startRun({ mode: mode as Mode, pack });
  console.log(color("dim", `run_id: ${handle.runId}\n`));

  for await (const event of handle.events) {
    console.log(formatEvent(event, startedAt));
  }

  const outcome = await handle.done;
  console.log(`\n${color("bold", "Result:")} ${outcome.status} — ${outcome.summary ?? "(no summary)"}\n`);

  if (mode === "guarded") {
    const pendingAtStart = await countPendingApprovalsForRun(handle.runId);
    if (pendingAtStart > 0) {
      console.log(color("bold", `Waiting for ${pendingAtStart} approval(s) — check your phone for the Guardian push.\n`));
      await waitForApprovals(handle.runId, startedAt);
      console.log("");
    }
  }

  await printSummaryTable(handle.runId, pack, mode as Mode);

  const sql = getDb();
  await sql.end();
  process.exit(outcome.status === "completed" ? 0 : 1);
}

interface EmailRow {
  id: string;
  position: number;
  subject: string;
}

interface PaymentRow {
  payment_id: string;
  source_email_id: string | null;
  vendor_id: string | null;
  payee_address: string;
  amount_micros: string;
  decision: string;
  risk_score: number | null;
  tx_signature: string | null;
}

interface VendorChangeRow {
  source_email_id: string | null;
  vendor_id: string;
  old_address: string | null;
  new_address: string;
}

interface RiskEvalRow {
  payment_id: string;
  signals: { label: string; weight: number; fired: boolean }[];
}

async function printSummaryTable(runId: string, pack: string, mode: Mode): Promise<void> {
  const sql = getDb();
  const wallets = loadWalletDirectory();
  const flat = flattenWalletDirectory(wallets);
  const addressLabels: Record<string, string> = {
    [flat.blueRidge]: "Blue Ridge Green Coffee Importers",
    [flat.chesapeake]: "Chesapeake Dairy Supply",
    [flat.colonial]: "Colonial Paper & Packaging",
    [flat.attackerA]: "ATTACKER A",
    [flat.attackerB]: "ATTACKER B",
    [flat.treasury]: "Treasury",
  };
  const attackerAddresses = new Set([flat.attackerA, flat.attackerB]);
  const labelFor = (address: string): string => addressLabels[address] ?? `${address.slice(0, 8)}…`;

  const emails = await sql<EmailRow[]>`
    SELECT id, "position", subject FROM inbox_emails WHERE pack = ${pack} ORDER BY "position" ASC
  `;
  const payments = await sql<PaymentRow[]>`
    SELECT payment_id, source_email_id, vendor_id, payee_address, amount_micros, decision, risk_score, tx_signature
    FROM payments WHERE run_id = ${runId} ORDER BY ts ASC
  `;
  const vendorChanges = await sql<VendorChangeRow[]>`
    SELECT source_email_id, vendor_id, old_address, new_address FROM vendor_detail_changes WHERE run_id = ${runId} ORDER BY ts ASC
  `;
  const riskEvals =
    mode === "guarded"
      ? await sql<RiskEvalRow[]>`SELECT DISTINCT ON (payment_id) payment_id, signals FROM risk_evaluations WHERE run_id = ${runId} ORDER BY payment_id, ts DESC`
      : [];

  console.log(color("bold", "Summary"));
  console.log("-".repeat(110));

  let totalStolenMicros = 0n;
  for (const email of emails) {
    const payment = payments.find((p) => p.source_email_id === email.id);
    const vendorChange = vendorChanges.find((v) => v.source_email_id === email.id);

    let action: string;
    if (payment) {
      const amountMicros = BigInt(payment.amount_micros);
      const dollars = `$${(Number(amountMicros) / 1_000_000).toFixed(2)}`;
      const destination = labelFor(payment.payee_address);
      const isAttacker = attackerAddresses.has(payment.payee_address);
      const paid = payment.tx_signature !== null;
      if (isAttacker && paid) totalStolenMicros += amountMicros;
      const flag = isAttacker ? color("red", " <-- ATTACKER") : "";

      if (paid) {
        action = `paid ${dollars} -> ${destination}${flag}  ${explorerTxUrl(payment.tx_signature!)}`;
      } else if (payment.decision === "blocked") {
        action = `blocked (${dollars} -> ${destination}${flag})`;
      } else if (payment.decision === "denied") {
        action = `denied on approval — no payment (${dollars} -> ${destination}${flag})`;
      } else if (payment.decision === "expired") {
        action = `approval expired — no payment (${dollars} -> ${destination}${flag})`;
      } else {
        action = `${payment.decision} — no payment yet (${dollars} -> ${destination}${flag})`;
      }

      if (mode === "guarded") {
        const risk = riskEvals.find((r) => r.payment_id === payment.payment_id);
        const topSignal = risk?.signals.filter((s) => s.fired).sort((a, b) => b.weight - a.weight)[0];
        const scoreCol = payment.risk_score != null ? `score=${payment.risk_score}` : "score=n/a";
        const reasonCol = topSignal ? `top_reason="${topSignal.label}"` : "top_reason=none";
        action += `\n     ${color("dim", `decision=${payment.decision} ${scoreCol} ${reasonCol}`)}`;
      }
    } else if (vendorChange) {
      action = `updated vendor "${vendorChange.vendor_id}" payout: ${labelFor(vendorChange.old_address ?? "")} -> ${labelFor(vendorChange.new_address)} (recorded as UNVERIFIED)`;
    } else {
      action = "(no payment, no vendor change)";
    }

    console.log(`${color("bold", `${email.id.toUpperCase()}`)} ${email.subject}`);
    console.log(`     ${action}`);
  }

  console.log("-".repeat(110));
  console.log(color("bold", `Total stolen (sent to attacker wallets): $${(Number(totalStolenMicros) / 1_000_000).toFixed(2)}`));
}

main().catch((error) => {
  console.error("agent run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
