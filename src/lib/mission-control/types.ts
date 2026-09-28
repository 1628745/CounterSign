import type { AgentEventKind } from "@/lib/db/events";
import type { Decision, Signal } from "@/lib/countersign/types";

export type Mode = "naive" | "guarded";

/** Same shape as ProvenanceHit/Provenance (src/lib/countersign/types.ts), but
 * receivedAt is a string once it's crossed JSON — the server type's `Date`
 * would be a lie on this side. */
export interface ProvenanceHitDTO {
  source: "registry" | "email";
  emailId?: string;
  sender?: string;
  visible: boolean;
  offsetStart?: number;
  offsetEnd?: number;
  receivedAt: string;
}

export interface ProvenanceDTO {
  payeeAddress: string;
  hits: ProvenanceHitDTO[];
}

export interface ClientEvent {
  seq: string;
  runId: string;
  kind: AgentEventKind;
  emailId: string | null;
  paymentId: string | null;
  payload: Record<string, unknown>;
  ts: string;
}

export interface InboxMarkersDTO {
  invoiceAmountMicros: string | null;
  hasHiddenText: boolean;
  isLookalikeSender: boolean;
  requestsVendorChange: boolean;
}

export interface InboxEmailDTO {
  id: string;
  position: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  html: string;
  markers: InboxMarkersDTO;
}

export type WalletGroup = "treasury" | "vendor" | "unrecognized";

export interface WalletDTO {
  id: string;
  label: string;
  group: WalletGroup;
  address: string;
  musdcMicros: string;
}

export interface RunMoneyStatDTO {
  runId: string;
  mode: string;
  startedAt: string;
  stolenMicros: string;
  paidMicros: string;
  heldMicros: string;
  blockedMicros: string;
}

export interface ApprovalDTO {
  status: "pending" | "approved" | "denied" | "expired";
  bindingMessage: string;
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  countdownSeconds: number | null;
  expiresInSeconds: number | null;
}

export interface PaymentDetailDTO {
  payment: {
    paymentId: string;
    ts: string;
    mode: string;
    vendorId: string | null;
    payeeAddress: string;
    amountMicros: string;
    invoiceNumber: string | null;
    sourceEmailId: string | null;
    decision: string;
    riskScore: number | null;
    txSignature: string | null;
    txStatus: string;
    explorerUrl: string | null;
  };
  risk: { score: number; decision: Decision; signals: Signal[]; provenance: ProvenanceDTO } | null;
  approval: ApprovalDTO | null;
  simulatedBalanceDeltas: { treasury: number; payee: number };
}
