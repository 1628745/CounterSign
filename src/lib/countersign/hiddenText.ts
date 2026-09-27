/** One span of text detected as hidden in the source HTML. */
export interface HiddenSpan {
  text: string;
  offsetStart: number;
  offsetEnd: number;
  reason:
    | "display-none"
    | "visibility-hidden"
    | "opacity-zero"
    | "tiny-font"
    | "color-match-background"
    | "zero-width-chars";
}

/**
 * Detects hidden text in an email's HTML using cheerio: display:none,
 * visibility:hidden, opacity:0, font-size <= 2px, text colored like its
 * background, and zero-width characters (SPEC.md section 8).
 *
 * TODO(policy prompt): implement with cheerio.
 */
export function detectHiddenText(html: string): HiddenSpan[] {
  void html;
  throw new Error("TODO: implement detectHiddenText — see SPEC.md section 8");
}
