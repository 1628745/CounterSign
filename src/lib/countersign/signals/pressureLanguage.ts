import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** pressure_language +5: urgency or secrecy cues (regex list). */
export function pressureLanguage(intent: PaymentIntent, context: PolicyContext): Signal {
  const result = context.pressure;
  return {
    key: "pressure_language",
    label: "Pressure language",
    weight: 5,
    fired: result.fired,
    evidence: {
      sentence: result.fired
        ? `The source email uses urgency/secrecy language: ${result.matches.join(", ")}.`
        : `The source email does not use urgency or secrecy language.`,
      data: { matches: result.matches },
    },
  };
}
