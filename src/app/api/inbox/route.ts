import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { annotateHiddenHtml } from "@/lib/countersign/htmlText";
import { computeInboxMarkers } from "@/lib/countersign/inboxMarkers";
import { listFullInboxEmails } from "@/lib/db/queries/emails";

/**
 * GET /api/inbox?pack=demo — new route (docs/DESIGN.md section A8). The
 * Inbox column's slip markers and the Document Viewer's hidden-text reveal
 * need two things no existing route serves: per-email markers and HTML
 * annotated with data-cs-hidden. Composed entirely from existing pure
 * functions (annotateHiddenHtml, computeInboxMarkers, both additive — see
 * htmlText.ts/inboxMarkers.ts); listFullInboxEmails itself is unmodified.
 * Needs a session; src/proxy.ts already protects this route.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const pack = url.searchParams.get("pack") ?? "demo";

  const emails = await listFullInboxEmails(pack);

  return NextResponse.json({
    emails: emails.map((email) => ({
      id: email.id,
      position: email.position,
      fromName: email.fromName,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      html: annotateHiddenHtml(email.html),
      markers: computeInboxMarkers(email.html, email.fromAddress),
    })),
  });
}
