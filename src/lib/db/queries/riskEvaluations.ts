import { getDb } from "../client";

/** Writes to the risk_evaluations hypertable (SPEC.md section 5) — one row per gateway decision. */
export async function insertRiskEvaluation(params: {
  paymentId: string;
  runId: string | null;
  score: number;
  decision: string;
  signals: unknown;
  provenance: unknown;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO risk_evaluations (ts, payment_id, run_id, score, decision, signals, provenance)
    VALUES (
      now(), ${params.paymentId}, ${params.runId}, ${params.score}, ${params.decision},
      ${sql.json(JSON.parse(JSON.stringify(params.signals)))}, ${sql.json(JSON.parse(JSON.stringify(params.provenance)))}
    )
  `;
}

export interface RiskEvaluationRow {
  ts: Date;
  paymentId: string;
  runId: string | null;
  score: number;
  decision: string;
  signals: unknown;
  provenance: unknown;
}

/** Most recent risk evaluation for a payment — backs GET /api/payments/[id]. */
export async function getLatestRiskEvaluation(paymentId: string): Promise<RiskEvaluationRow | null> {
  const sql = getDb();
  const rows = await sql<{ ts: Date; payment_id: string; run_id: string | null; score: number; decision: string; signals: unknown; provenance: unknown }[]>`
    SELECT ts, payment_id, run_id, score, decision, signals, provenance
    FROM risk_evaluations WHERE payment_id = ${paymentId} ORDER BY ts DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    ts: rows[0].ts,
    paymentId: rows[0].payment_id,
    runId: rows[0].run_id,
    score: rows[0].score,
    decision: rows[0].decision,
    signals: rows[0].signals,
    provenance: rows[0].provenance,
  };
}
