import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** classifier_flag +10: quarantined LLM (see ../classifier.ts) rates fraud likelihood >= 0.7, cached per email. */
export function classifierFlag(intent: PaymentIntent, context: PolicyContext): Signal {
  const { fraud_likelihood, cues } = context.classifier;
  const fired = fraud_likelihood >= 0.7;
  const pct = (fraud_likelihood * 100).toFixed(0);
  return {
    key: "classifier_flag",
    label: "Classifier flag",
    weight: 10,
    fired,
    evidence: {
      sentence: fired
        ? `The quarantined fraud classifier rated this email ${pct}% likely fraudulent: ${cues.join(", ")}.`
        : `The quarantined fraud classifier rated this email ${pct}% likely fraudulent, below the 70% threshold.`,
      data: { fraudLikelihood: fraud_likelihood, cues },
    },
  };
}
