import { amountAnomaly } from "./signals/amountAnomaly";
import { classifierFlag } from "./signals/classifierFlag";
import { duplicateInvoice } from "./signals/duplicateInvoice";
import { execImpersonation } from "./signals/execImpersonation";
import { hiddenOnlyPayee } from "./signals/hiddenOnlyPayee";
import { hiddenTextSignal } from "./signals/hiddenText";
import { lookalikeSender } from "./signals/lookalikeSender";
import { newPayee } from "./signals/newPayee";
import { payeeUnverified } from "./signals/payeeUnverified";
import { pressureLanguage } from "./signals/pressureLanguage";
import { recentUnverifiedChange } from "./signals/recentUnverifiedChange";
import { untrustedProvenance } from "./signals/untrustedProvenance";
import { velocitySpike } from "./signals/velocitySpike";
import type { Decision, PaymentIntent, PolicyContext, PolicyResult, Signal } from "./types";

/** score >= 110 -> blocked; 30-109 -> approval required; below 30 -> auto-pay (SPEC.md section 8). */
const BLOCK_THRESHOLD = 110;
const APPROVAL_THRESHOLD = 30;

/**
 * evaluate() is a pure, deterministic function: same intent + context in,
 * same PolicyResult out, no I/O (SPEC.md section 14, #2). All Tiger Data
 * reads and detector calls happen in gateway.ts and are handed in via
 * `context`.
 */
export function evaluate(intent: PaymentIntent, context: PolicyContext): PolicyResult {
  const scoredSignals: Signal[] = [
    payeeUnverified(intent, context),
    untrustedProvenance(intent, context),
    hiddenTextSignal(intent, context),
    lookalikeSender(intent, context),
    recentUnverifiedChange(intent, context),
    newPayee(intent, context),
    amountAnomaly(intent, context),
    velocitySpike(intent, context),
    execImpersonation(intent, context),
    pressureLanguage(intent, context),
    classifierFlag(intent, context),
  ];

  const hardBlockSignals: Signal[] = [duplicateInvoice(intent, context), hiddenOnlyPayee(intent, context)];
  const hardBlockReasons = hardBlockSignals.filter((s) => s.fired).map((s) => s.evidence.sentence);

  const score = scoredSignals.reduce((sum, s) => sum + (s.fired ? s.weight : 0), 0);

  let decision: Decision;
  if (hardBlockReasons.length > 0 || score >= BLOCK_THRESHOLD) {
    decision = "blocked";
  } else if (score >= APPROVAL_THRESHOLD) {
    decision = "approval_required";
  } else {
    decision = "auto_pay";
  }

  return {
    score,
    decision,
    signals: [...scoredSignals, ...hardBlockSignals],
    provenance: context.provenance,
    hardBlockReasons,
  };
}
