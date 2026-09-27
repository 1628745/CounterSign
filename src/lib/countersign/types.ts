// Shared types for the Countersign gateway/policy engine. See SPEC.md sections 3 and 8.
// TODO: refine as gateway.ts, policy.ts and the signals are implemented.

/** A payment an agent (or a human, via the demo UI) is proposing. */
export interface PaymentIntent {
  vendor: string | null;
  payeeAddress: string;
  /** Money is bigint micro-units everywhere (SPEC.md section 14, #4). */
  amountMicros: bigint;
  invoiceNumber: string | null;
  sourceEmailId: string;
}

/** Read-only context gateway.ts assembles from Tiger Data before calling policy.evaluate. */
export interface PolicyContext {
  now: Date;
  // TODO: vendor registry rows, vendor_notes, vendor_detail_changes, payment history,
  // vendor_spend_daily rows, and the classifier_flag result all get threaded in here
  // so that policy.evaluate stays a pure function (SPEC.md section 14, #2).
}

export type Decision = "auto_pay" | "approval_required" | "blocked";

/** One scored signal, per SPEC.md section 8. */
export interface Signal {
  key: string;
  label: string;
  weight: number;
  fired: boolean;
  evidence: string;
  /** Present for Tiger-backed signals (amount_anomaly, velocity_spike, new_payee, ...). */
  query?: string;
  values?: Record<string, unknown>;
}

/** One occurrence of a payee address, for the provenance thread (SPEC.md section 8). */
export interface ProvenanceHit {
  source: "registry" | "email";
  emailId?: string;
  visible: boolean;
  offsetStart?: number;
  offsetEnd?: number;
}

export interface Provenance {
  payeeAddress: string;
  hits: ProvenanceHit[];
}

export interface PolicyResult {
  score: number;
  decision: Decision;
  signals: Signal[];
  provenance: Provenance;
}
