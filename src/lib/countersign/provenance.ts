import { listFullInboxEmails } from "@/lib/db/queries/emails";
import { listVendorsWithNotes } from "@/lib/db/queries/vendors";
import { renderNaiveEmail } from "./htmlText";
import type { Provenance, ProvenanceHit } from "./types";

export function findAllOccurrences(haystack: string, needle: string): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = [];
  if (needle.length === 0) return hits;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    hits.push({ start: index, end: index + needle.length });
    index = haystack.indexOf(needle, index + 1);
  }
  return hits;
}

/**
 * Finds every occurrence of a payee address across the vendor registry and
 * all inbox emails in `pack` — visible vs hidden, with character offsets,
 * earliest first (SPEC.md section 8). Registry entries are dated at the
 * vendor's verified_at so they sort correctly against email timestamps.
 */
export async function findProvenance(payeeAddress: string, pack: string): Promise<Provenance> {
  const hits: ProvenanceHit[] = [];

  // "The registry" means the verified vendor registry specifically — NOT
  // vendor_notes, which SPEC.md section 3 calls "the agent's poisonable
  // working memory." A payout address that only matches vendor_notes (e.g.
  // after a poisoning update_vendor_payment_details call) must NOT count
  // as a registry hit, or untrusted_provenance would wrongly stop firing
  // for exactly the addresses it exists to catch.
  const vendors = await listVendorsWithNotes();
  for (const vendor of vendors) {
    if (vendor.verifiedAddress === payeeAddress) {
      hits.push({ source: "registry", visible: true, receivedAt: vendor.verifiedAt });
    }
  }

  const emails = await listFullInboxEmails(pack);
  for (const email of emails) {
    const { text, hiddenSpans } = renderNaiveEmail(email.html);
    for (const occurrence of findAllOccurrences(text, payeeAddress)) {
      const visible = !hiddenSpans.some((span) => occurrence.start < span.offsetEnd && occurrence.end > span.offsetStart);
      hits.push({
        source: "email",
        emailId: email.id,
        sender: email.fromAddress,
        visible,
        offsetStart: occurrence.start,
        offsetEnd: occurrence.end,
        receivedAt: email.receivedAt,
      });
    }
  }

  hits.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  return { payeeAddress, hits };
}
