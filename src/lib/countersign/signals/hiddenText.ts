import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** hidden_text +25: the source email contains hidden text (see ../hiddenText.ts for detection). */
export function hiddenTextSignal(intent: PaymentIntent, context: PolicyContext): Signal {
  const count = context.sourceEmail?.hiddenSpans.length ?? 0;
  const fired = count > 0;
  return {
    key: "hidden_text",
    label: "Hidden text in source email",
    weight: 25,
    fired,
    evidence: {
      sentence: fired
        ? `The source email (${context.sourceEmail?.id}) contains ${count} hidden span${count === 1 ? "" : "s"} not visible to a human reader.`
        : `The source email contains no hidden text.`,
      data: { emailId: context.sourceEmail?.id ?? null, hiddenSpanCount: count },
    },
  };
}
