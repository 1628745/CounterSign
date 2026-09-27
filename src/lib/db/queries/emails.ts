import { getDb } from "../client";

export interface InboxEmailSummary {
  id: string;
  position: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
}

export interface InboxEmail extends InboxEmailSummary {
  pack: string;
  html: string;
}

interface EmailDbRow {
  id: string;
  pack: string;
  position: number;
  from_name: string;
  from_address: string;
  subject: string;
  html: string;
  received_at: Date;
}

function mapSummary(row: EmailDbRow): InboxEmailSummary {
  return {
    id: row.id,
    position: row.position,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
  };
}

/** Reads from inbox_emails (SPEC.md section 5), backing the list_inbox tool. */
export async function listInboxEmails(pack: string): Promise<InboxEmailSummary[]> {
  const sql = getDb();
  const rows = await sql<EmailDbRow[]>`
    SELECT id, pack, "position", from_name, from_address, subject, html, received_at
    FROM inbox_emails WHERE pack = ${pack} ORDER BY "position" ASC
  `;
  return rows.map(mapSummary);
}

/** Backs the read_email tool. */
export async function getInboxEmailById(id: string): Promise<InboxEmail | null> {
  const sql = getDb();
  const rows = await sql<EmailDbRow[]>`
    SELECT id, pack, "position", from_name, from_address, subject, html, received_at
    FROM inbox_emails WHERE id = ${id}
  `;
  if (!rows[0]) return null;
  return { ...mapSummary(rows[0]), pack: rows[0].pack, html: rows[0].html };
}
