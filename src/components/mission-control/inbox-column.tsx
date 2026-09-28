"use client";

import { useState } from "react";
import { DocumentViewer } from "@/components/mission-control/document-viewer";
import { InboxSlip } from "@/components/mission-control/inbox-slip";
import { InboxSlipSkeleton } from "@/components/mission-control/skeleton";
import { useMissionControlStore } from "@/lib/mission-control/store";
import { getActiveReadingEmailId, getEmailRunState } from "@/lib/mission-control/selectors";

export function InboxColumn() {
  const inbox = useMissionControlStore((s) => s.inbox);
  const inboxLoaded = useMissionControlStore((s) => s.inboxLoaded);
  const events = useMissionControlStore((s) => s.events);
  const payments = useMissionControlStore((s) => s.payments);
  const runStatus = useMissionControlStore((s) => s.runStatus);
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);

  const activeReadingEmailId = getActiveReadingEmailId(events, runStatus);
  const openEmail = inbox.find((e) => e.id === openEmailId) ?? null;

  if (!inboxLoaded) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-3" style={{ width: 320 }}>
        <h2 className="mb-2 px-1 text-[13px] font-semibold text-[var(--cs-ink)]">Inbox</h2>
        {Array.from({ length: 8 }).map((_, i) => (
          <InboxSlipSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3" style={{ width: 320 }}>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-[var(--cs-ink)]">Inbox</h2>
      {inbox.map((email) => {
        const { outcome } = getEmailRunState(email.id, events, payments);
        return (
          <InboxSlip
            key={email.id}
            email={email}
            reading={activeReadingEmailId === email.id}
            outcome={outcome}
            onOpen={() => setOpenEmailId(email.id)}
          />
        );
      })}
      <DocumentViewer email={openEmail} onOpenChange={(open) => !open && setOpenEmailId(null)} />
    </div>
  );
}
