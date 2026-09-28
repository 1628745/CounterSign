import { renderNaiveEmail } from "./htmlText";
import { checkLookalikeSender } from "./lookalike";

export interface InboxMarkers {
  /** Largest dollar figure mentioned in the email — the demo's invoices always list line items
   * then a bolded total, so the largest figure is always the total (verified against E1-E8). */
  invoiceAmountMicros: string | null;
  hasHiddenText: boolean;
  isLookalikeSender: boolean;
  requestsVendorChange: boolean;
}

const DOLLAR_RE = /\$([\d,]+\.\d{2})/g;
const VENDOR_CHANGE_RE = /(remittance|payout|wallet).{0,40}(updat|chang|new)|(?:updat|chang|new).{0,40}(remittance|payout|wallet)/i;

/**
 * Mission Control inbox markers (docs/DESIGN.md section A8) — composed
 * entirely from existing pure detectors (renderNaiveEmail, checkLookalikeSender)
 * plus two small heuristics scoped to display only. Does not change, and is
 * not used by, the policy engine or the agent's tools.
 */
export function computeInboxMarkers(html: string, fromAddress: string): InboxMarkers {
  const { text, hiddenSpans } = renderNaiveEmail(html);

  let maxDollars: number | null = null;
  for (const match of text.matchAll(DOLLAR_RE)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (maxDollars === null || value > maxDollars) maxDollars = value;
  }

  return {
    invoiceAmountMicros: maxDollars !== null ? Math.round(maxDollars * 1_000_000).toString() : null,
    hasHiddenText: hiddenSpans.length > 0,
    isLookalikeSender: checkLookalikeSender(fromAddress).isLookalike,
    requestsVendorChange: VENDOR_CHANGE_RE.test(text),
  };
}
