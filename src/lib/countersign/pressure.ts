export interface PressureResult {
  fired: boolean;
  matches: string[];
}

/** Urgency and secrecy cues (SPEC.md section 8's pressure_language signal). */
const PRESSURE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\burgent(ly)?\b/i, label: "urgent" },
  { pattern: /\bconfidential(ly)?\b/i, label: "confidential" },
  { pattern: /\bkeep (this|it) quiet\b/i, label: "keep this quiet" },
  { pattern: /\bdiscreetly?\b/i, label: "discreetly" },
  { pattern: /\bdo not mention\b/i, label: "do not mention" },
  { pattern: /\bboarding a flight\b/i, label: "boarding a flight" },
  { pattern: /\bwon'?t be reachable\b/i, label: "won't be reachable" },
  { pattern: /\beffective immediately\b/i, label: "effective immediately" },
  { pattern: /\bright away\b/i, label: "right away" },
  { pattern: /\bimmediately\b/i, label: "immediately" },
  { pattern: /\bas soon as possible\b/i, label: "as soon as possible" },
];

/** Detects urgency/secrecy pressure language in plain text (regex list, SPEC.md section 8). */
export function detectPressure(text: string): PressureResult {
  const matches: string[] = [];
  for (const { pattern, label } of PRESSURE_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(label);
    }
  }
  return { fired: matches.length > 0, matches };
}
