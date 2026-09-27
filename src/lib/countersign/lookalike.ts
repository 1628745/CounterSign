/**
 * Detects whether `domain` is a lookalike of one of the known vendor domains:
 * edit distance <= 2, hyphen insertion, TLD swap, or homoglyphs (rn/m, 0/o,
 * 1/l) (SPEC.md section 8). Uses fastest-levenshtein for edit distance.
 *
 * TODO(policy prompt): implement.
 */
export function isLookalikeDomain(domain: string, knownDomains: string[]): boolean {
  void domain;
  void knownDomains;
  throw new Error("TODO: implement isLookalikeDomain — see SPEC.md section 8");
}
