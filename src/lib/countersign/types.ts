// Shared types for the Countersign gateway/policy engine. See SPEC.md sections 3 and 8.

/** A payment an agent (or a human, via the demo UI) is proposing. */
export interface PaymentIntent {
  /** vendor_id, or null if this isn't a known vendor at all (e.g. E7's "consultant"). */
  vendor: string | null;
  payeeAddress: string;
  /** Money is bigint micro-units everywhere (SPEC.md section 14, #4). */
  amountMicros: bigint;
  invoiceNumber: string | null;
  sourceEmailId: string;
}

export type Decision = "auto_pay" | "approval_required" | "blocked";

/** One scored signal, per SPEC.md section 8. */
export interface SignalEvidence {
  sentence: string;
  data: Record<string, unknown>;
}

export interface Signal {
  key: string;
  label: string;
  weight: number;
  fired: boolean;
  evidence: SignalEvidence;
  /** Present for Tiger-backed signals (amount_anomaly, velocity_spike, new_payee, ...). */
  query?: string;
  result?: unknown;
}

/** One occurrence of a payee address, for the provenance thread (SPEC.md section 8). */
export interface ProvenanceHit {
  source: "registry" | "email";
  emailId?: string;
  sender?: string;
  visible: boolean;
  offsetStart?: number;
  offsetEnd?: number;
  receivedAt: Date;
}

export interface Provenance {
  payeeAddress: string;
  /** Earliest first (SPEC.md section 8). */
  hits: ProvenanceHit[];
}

export interface PolicyResult {
  score: number;
  decision: Decision;
  signals: Signal[];
  provenance: Provenance;
  /** Set when decision is "blocked" via a hard block rather than the score threshold. */
  hardBlockReasons: string[];
}

// --- Context gateway.ts assembles from Tiger Data + detectors before calling policy.evaluate. ---
// evaluate() itself does no I/O (non-negotiable #2); every value below is
// pre-computed so the signals can be pure functions of (intent, context).

import type { DuplicateInvoiceResult } from "@/lib/db/queries/policyQueries";
import type { ExecImpersonationResult } from "./execImpersonation";
import type { LookalikeResult } from "./lookalike";
import type { PressureResult } from "./pressure";

export interface VendorInfo {
  id: string;
  name: string;
  domain: string;
  verifiedAddress: string;
  /** Current vendor_notes.payout_address — may be poisoned. */
  payoutAddress: string;
}

export interface EmailInfo {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  text: string;
  hiddenSpans: { offsetStart: number; offsetEnd: number }[];
}

export interface PolicyContext {
  now: Date;
  /** The vendor named in the intent, resolved — null if not a known vendor. */
  vendor: VendorInfo | null;
  /** The email that proposed this payment. */
  sourceEmail: EmailInfo | null;
  /** Every known verified address, for payee_unverified. */
  verifiedAddresses: string[];
  /** Every occurrence of intent.payeeAddress across the registry and all inbox emails. */
  provenance: Provenance;
  /** Lookalike check on the sender of the FIRST email where the payee address appears (may differ from sourceEmail). */
  firstAppearanceLookalike: LookalikeResult | null;
  recentUnverifiedChange: { result: boolean; query: string };
  hasSuccessfulPaymentTo: { result: boolean; query: string };
  vendorMedian90d: { result: number | null; query: string };
  vendorMaxDaily90d: { result: number | null; query: string };
  vendorSpendToday: { result: number; query: string };
  duplicateInvoice: { result: DuplicateInvoiceResult; query: string };
  lookalikeSender: LookalikeResult;
  pressure: PressureResult;
  execImpersonation: ExecImpersonationResult;
  classifier: { fraud_likelihood: number; cues: string[] };
}
