import { getDb } from "../client";

export interface VendorRow {
  id: string;
  name: string;
  domain: string;
  verifiedAddress: string;
  verifiedAt: Date;
  verificationMethod: string;
}

export interface VendorWithPayout extends VendorRow {
  payoutAddress: string;
  notesUpdatedAt: Date;
  notesUpdatedFromEmail: string | null;
}

interface VendorDbRow {
  id: string;
  name: string;
  domain: string;
  verified_address: string;
  verified_at: Date;
  verification_method: string;
}

function mapVendor(row: VendorDbRow): VendorRow {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    verifiedAddress: row.verified_address,
    verifiedAt: row.verified_at,
    verificationMethod: row.verification_method,
  };
}

/**
 * Resolves a free-text vendor name (as the agent would type it, reading it
 * off an email) to a vendor row: exact (case-insensitive) match on name or
 * id first, falling back to a partial match. Returns null for names that
 * aren't a real vendor at all (e.g. E7's "consultant") — that's expected,
 * not an error.
 */
export async function findVendorByName(name: string): Promise<VendorRow | null> {
  const sql = getDb();
  const exact = await sql<VendorDbRow[]>`
    SELECT * FROM vendors WHERE lower(name) = lower(${name}) OR lower(id) = lower(${name})
  `;
  if (exact[0]) return mapVendor(exact[0]);

  const partial = await sql<VendorDbRow[]>`
    SELECT * FROM vendors WHERE name ILIKE ${"%" + name + "%"} LIMIT 1
  `;
  return partial[0] ? mapVendor(partial[0]) : null;
}

/** Reads from vendors + vendor_notes (SPEC.md section 5) — backs the get_vendor tool. */
export async function getVendorByName(name: string): Promise<VendorWithPayout | null> {
  const vendor = await findVendorByName(name);
  if (!vendor) return null;

  const sql = getDb();
  const notes = await sql<{ payout_address: string; updated_at: Date; updated_from_email: string | null }[]>`
    SELECT payout_address, updated_at, updated_from_email FROM vendor_notes WHERE vendor_id = ${vendor.id}
  `;
  if (!notes[0]) return null;

  return {
    ...vendor,
    payoutAddress: notes[0].payout_address,
    notesUpdatedAt: notes[0].updated_at,
    notesUpdatedFromEmail: notes[0].updated_from_email,
  };
}

/** Writes vendor_notes + a vendor_detail_changes row (verified = false), per SPEC.md section 7. */
export async function updateVendorPaymentDetails(params: {
  vendorId: string;
  newAddress: string;
  sourceEmailId: string;
  runId: string | null;
}): Promise<{ oldAddress: string | null }> {
  const sql = getDb();
  return sql.begin(async (tx) => {
    const [current] = await tx<{ payout_address: string }[]>`
      SELECT payout_address FROM vendor_notes WHERE vendor_id = ${params.vendorId}
    `;
    const [email] = await tx<{ from_address: string }[]>`
      SELECT from_address FROM inbox_emails WHERE id = ${params.sourceEmailId}
    `;
    await tx`
      UPDATE vendor_notes
      SET payout_address = ${params.newAddress}, updated_at = now(), updated_from_email = ${params.sourceEmailId}
      WHERE vendor_id = ${params.vendorId}
    `;
    await tx`
      INSERT INTO vendor_detail_changes (ts, vendor_id, old_address, new_address, source_email_id, sender_address, verified, run_id)
      VALUES (
        now(), ${params.vendorId}, ${current?.payout_address ?? null}, ${params.newAddress},
        ${params.sourceEmailId}, ${email?.from_address ?? null}, false, ${params.runId}
      )
    `;
    return { oldAddress: current?.payout_address ?? null };
  });
}
