import type { Provenance } from "./types";

/**
 * Finds every occurrence of a payee address across the vendor registry and
 * all inbox emails (visible vs hidden, with character offsets), so the UI
 * can draw a provenance thread (SPEC.md section 8).
 *
 * TODO(policy prompt): implement using src/lib/countersign/hiddenText.ts to
 * distinguish visible from hidden occurrences.
 */
export function findProvenance(payeeAddress: string): Provenance {
  void payeeAddress;
  throw new Error("TODO: implement findProvenance — see SPEC.md section 8");
}
