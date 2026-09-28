import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { getRecentRunMoneyStats } from "@/lib/db/queries/runStats";
import { getAllBalances } from "@/lib/solana/balances";
import { loadWalletDirectory } from "@/lib/solana/wallets";

const LABELS: Record<string, { label: string; group: "treasury" | "vendor" | "unrecognized" }> = {
  treasury: { label: "Treasury", group: "treasury" },
  blueRidge: { label: "Blue Ridge Green Coffee Importers", group: "vendor" },
  chesapeake: { label: "Chesapeake Dairy Supply", group: "vendor" },
  colonial: { label: "Colonial Paper & Packaging", group: "vendor" },
  attackerA: { label: "Unrecognized wallet A", group: "unrecognized" },
  attackerB: { label: "Unrecognized wallet B", group: "unrecognized" },
};

/**
 * GET /api/wallets — in SPEC.md's route list already; not built until now
 * (docs/DESIGN.md section A8). Wallet balances via the existing
 * getAllBalances()/loadWalletDirectory() (unmodified), plus a new
 * read-only "last two runs" aggregate for the Money column's guard-off vs
 * guard-on comparison. Needs a session; src/proxy.ts already protects this
 * route.
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const directory = loadWalletDirectory();
  const balances = await getAllBalances();
  const attackerAddresses = [directory.attackers.attackerA, directory.attackers.attackerB];

  const wallets = Object.entries(LABELS).map(([id, meta]) => ({
    id,
    label: meta.label,
    group: meta.group,
    address: balances[id]?.address ?? "",
    musdcMicros: (balances[id]?.musdcMicros ?? 0n).toString(),
  }));

  const recentRuns = await getRecentRunMoneyStats(attackerAddresses);

  return NextResponse.json({
    wallets,
    recentRuns: recentRuns.map((run) => ({
      runId: run.runId,
      mode: run.mode,
      startedAt: run.startedAt,
      stolenMicros: run.stolenMicros.toString(),
      paidMicros: run.paidMicros.toString(),
      heldMicros: run.heldMicros.toString(),
      blockedMicros: run.blockedMicros.toString(),
    })),
  });
}
