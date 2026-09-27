import { renderNaiveEmail, type HiddenReason, type HiddenSpan } from "./htmlText";

export type { HiddenReason, HiddenSpan };

/**
 * Detects hidden text in an email's HTML: display:none, visibility:hidden,
 * opacity:0, font-size <= 2px, text colored like its background, and
 * zero-width characters (SPEC.md section 8). Offsets are character offsets
 * into the same naive rendered text src/lib/agent/tools.ts's read_email
 * returns, so the UI can point at exactly what the agent saw.
 */
export function detectHiddenText(html: string): HiddenSpan[] {
  return renderNaiveEmail(html).hiddenSpans;
}
