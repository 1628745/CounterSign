import { getDb } from "../client";

export interface RunMoneyStats {
  runId: string;
  mode: string;
  startedAt: Date;
  stolenMicros: bigint;
  paidMicros: bigint;
  heldMicros: bigint;
  blockedMicros: bigint;
}

interface RunStatsDbRow {
  run_id: string;
  mode: string;
  started_at: Date;
  stolen: string;
  paid: string;
  held: string;
  blocked: string;
}

/**
 * Mission Control's "Last two runs" comparison (docs/DESIGN.md section A8) —
 * a new, read-only aggregate over the existing payments/runs tables. Doesn't
 * change how any row gets written; only reads and buckets what's there.
 * stolen/paid are actual confirmed on-chain transfers; blocked is a policy
 * hard/score block that never reached a human or the signer; held is money
 * that went to a human (approval_pending/approved/denied/expired) and never
 * confirmed on-chain — this is what lets a denied request still show up as
 * "money a human stopped" instead of disappearing from the story.
 */
export async function getRecentRunMoneyStats(attackerAddresses: string[], limit = 2): Promise<RunMoneyStats[]> {
  const sql = getDb();
  const rows = await sql<RunStatsDbRow[]>`
    SELECT
      r.id AS run_id,
      r.mode,
      r.started_at,
      coalesce(sum(CASE WHEN p.tx_status = 'confirmed' AND p.payee_address = ANY(${attackerAddresses}) THEN p.amount_micros ELSE 0 END), 0) AS stolen,
      coalesce(sum(CASE WHEN p.tx_status = 'confirmed' AND p.payee_address != ALL(${attackerAddresses}) THEN p.amount_micros ELSE 0 END), 0) AS paid,
      coalesce(sum(CASE WHEN p.decision IN ('approval_pending', 'approved', 'denied', 'expired') AND p.tx_status != 'confirmed' THEN p.amount_micros ELSE 0 END), 0) AS held,
      coalesce(sum(CASE WHEN p.decision = 'blocked' THEN p.amount_micros ELSE 0 END), 0) AS blocked
    FROM runs r
    LEFT JOIN payments p ON p.run_id = r.id
    WHERE r.mode IN ('naive', 'guarded')
    GROUP BY r.id, r.mode, r.started_at
    ORDER BY r.started_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    runId: row.run_id,
    mode: row.mode,
    startedAt: row.started_at,
    stolenMicros: BigInt(row.stolen),
    paidMicros: BigInt(row.paid),
    heldMicros: BigInt(row.held),
    blockedMicros: BigInt(row.blocked),
  }));
}
