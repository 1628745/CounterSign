import { distance } from "fastest-levenshtein";

export type LookalikeTechnique = "hyphen-insertion" | "tld-swap" | "homoglyph" | "edit-distance";

export interface LookalikeResult {
  isLookalike: boolean;
  imitates: string | null;
  technique: LookalikeTechnique | null;
}

/** Known vendor domains, per SPEC.md section 2. */
export const KNOWN_VENDOR_DOMAINS = ["blueridgegreencoffee.com", "chesapeakedairy.com", "colonialpaperpack.com"];

function splitDomain(domain: string): { name: string; tld: string } {
  const idx = domain.lastIndexOf(".");
  return idx === -1 ? { name: domain, tld: "" } : { name: domain.slice(0, idx), tld: domain.slice(idx + 1) };
}

/** rn/m, 0/o, 1/l — collapses common homoglyph substitutions to a canonical form for comparison. */
function normalizeHomoglyphs(name: string): string {
  return name.replace(/rn/g, "m").replace(/0/g, "o").replace(/1/g, "l");
}

/**
 * Detects whether `domain` is a lookalike of one of the known vendor
 * domains: edit distance <= 2, hyphen insertion, TLD swap, or homoglyphs
 * (SPEC.md section 8).
 */
export function checkLookalike(domain: string, knownDomains: string[] = KNOWN_VENDOR_DOMAINS): LookalikeResult {
  const candidate = domain.toLowerCase().trim();
  const { name: candidateName, tld: candidateTld } = splitDomain(candidate);

  for (const known of knownDomains) {
    if (candidate === known) continue;
    const { name: knownName, tld: knownTld } = splitDomain(known);

    if (candidateName !== knownName && candidateName.replace(/-/g, "") === knownName.replace(/-/g, "")) {
      return { isLookalike: true, imitates: known, technique: "hyphen-insertion" };
    }
    if (candidateName === knownName && candidateTld !== knownTld) {
      return { isLookalike: true, imitates: known, technique: "tld-swap" };
    }
    if (candidateName !== knownName && normalizeHomoglyphs(candidateName) === normalizeHomoglyphs(knownName)) {
      return { isLookalike: true, imitates: known, technique: "homoglyph" };
    }
    if (candidateName !== knownName && distance(candidateName, knownName) <= 2) {
      return { isLookalike: true, imitates: known, technique: "edit-distance" };
    }
  }
  return { isLookalike: false, imitates: null, technique: null };
}

/** Convenience: extracts the domain from an email address and checks it. */
export function checkLookalikeSender(fromAddress: string, knownDomains: string[] = KNOWN_VENDOR_DOMAINS): LookalikeResult {
  const domain = fromAddress.split("@")[1] ?? "";
  return checkLookalike(domain, knownDomains);
}
