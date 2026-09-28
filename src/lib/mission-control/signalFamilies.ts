/** Risk-bar color grouping only (docs/DESIGN.md section A9) — signal keys/weights/order are untouched. */
export type SignalFamily = "provenance" | "history" | "content";

const FAMILY_BY_KEY: Record<string, SignalFamily> = {
  payee_unverified: "provenance",
  untrusted_provenance: "provenance",
  lookalike_sender: "provenance",
  new_payee: "provenance",
  recent_unverified_change: "history",
  velocity_spike: "history",
  amount_anomaly: "history",
  duplicate_invoice: "history",
  hidden_text: "content",
  pressure_language: "content",
  exec_impersonation: "content",
  classifier_flag: "content",
  hidden_only_payee: "content",
};

export function familyForSignal(key: string): SignalFamily {
  return FAMILY_BY_KEY[key] ?? "content";
}

export const FAMILY_LABEL: Record<SignalFamily, string> = {
  provenance: "Provenance",
  history: "History",
  content: "Content",
};
