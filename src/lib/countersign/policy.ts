import type { PaymentIntent, PolicyContext, PolicyResult } from "./types";

/**
 * evaluate() is a pure, deterministic function: same intent + context in,
 * same PolicyResult out, no I/O (SPEC.md section 14, #2). All Tiger Data
 * reads happen in gateway.ts and are handed in via `context`.
 *
 * TODO(policy prompt): implement scoring per SPEC.md section 8 —
 * payee_unverified(+40), untrusted_provenance(+15), hidden_text(+25),
 * lookalike_sender(+30), recent_unverified_change(+25), new_payee(+10),
 * amount_anomaly(+20), velocity_spike(+20), exec_impersonation(+15),
 * pressure_language(+5), classifier_flag(+10); hard blocks duplicate_invoice
 * and hidden_only_payee; decision thresholds blocked>=110, approval 30-109,
 * auto-pay <30. Scenario tests must cover E1-E8 (SPEC.md section 2).
 */
export function evaluate(intent: PaymentIntent, context: PolicyContext): PolicyResult {
  void intent;
  void context;
  throw new Error("TODO: implement policy.evaluate — see SPEC.md section 8");
}
