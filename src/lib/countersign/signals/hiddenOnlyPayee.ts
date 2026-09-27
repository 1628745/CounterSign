import { findAllOccurrences } from "../provenance";
import type { PaymentIntent, PolicyContext, Signal } from "../types";

/**
 * Hard block: the payee address appears in the source email only inside
 * hidden text — never anywhere visible in that same email (SPEC.md section
 * 8). Scoped to the source email deliberately: whether some other vendor's
 * email happens to show this address in plain text elsewhere doesn't change
 * the fact that *this* payment is being justified by an instruction no
 * human reading *this* email would ever see.
 */
export function hiddenOnlyPayee(intent: PaymentIntent, context: PolicyContext): Signal {
  const sourceEmail = context.sourceEmail;
  const occurrences = sourceEmail ? findAllOccurrences(sourceEmail.text, intent.payeeAddress) : [];
  const fired =
    sourceEmail !== null &&
    occurrences.length > 0 &&
    occurrences.every((occ) => sourceEmail.hiddenSpans.some((span) => occ.start < span.offsetEnd && occ.end > span.offsetStart));

  return {
    key: "hidden_only_payee",
    label: "Payee address only in hidden text",
    weight: 0,
    fired,
    evidence: {
      sentence: fired
        ? `The payee address appears in the source email (${sourceEmail?.id}) only inside hidden text, never in visible content.`
        : `The payee address does not appear exclusively in hidden text in the source email.`,
      data: { emailId: sourceEmail?.id ?? null, occurrenceCount: occurrences.length },
    },
  };
}
