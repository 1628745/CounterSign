"use client";

import { Ban, Check, Clock, Eye, PenLine, TimerOff, XCircle } from "lucide-react";
import { formatUsd, relativeTime } from "@/lib/mission-control/format";
import type { EmailOutcome } from "@/lib/mission-control/selectors";
import type { InboxEmailDTO } from "@/lib/mission-control/types";

const OUTCOME_GLYPH: Record<Exclude<EmailOutcome, null>, { icon: typeof Check; color: string; label: string }> = {
  paid: { icon: Check, color: "var(--cs-paid)", label: "Paid" },
  held: { icon: Clock, color: "var(--cs-held)", label: "Held for approval" },
  blocked: { icon: Ban, color: "var(--cs-void)", label: "Blocked" },
  declined: { icon: XCircle, color: "var(--cs-void)", label: "Declined" },
  expired: { icon: TimerOff, color: "var(--cs-ink-faded)", label: "Expired" },
  vendor_change: { icon: PenLine, color: "var(--cs-ink-faded)", label: "Vendor details updated" },
  read_only: { icon: Eye, color: "var(--cs-ink-faded)", label: "Read, no action taken" },
};

export interface InboxSlipProps {
  email: InboxEmailDTO;
  reading: boolean;
  outcome: EmailOutcome;
  onOpen: () => void;
}

export function InboxSlip({ email, reading, outcome, onOpen }: InboxSlipProps) {
  const glyph = outcome ? OUTCOME_GLYPH[outcome] : null;
  const Icon = glyph?.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-cs-email-id={email.id}
      className="block w-full text-left"
      style={{
        background: "var(--cs-sheet)",
        borderRadius: 2,
        borderBottom: "1px solid var(--cs-ink-faded)",
        borderLeft: reading ? "2px solid var(--cs-ink)" : "2px solid transparent",
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-[var(--cs-ink)]">{email.fromName}</span>
        <span className="cs-tabular shrink-0 text-[12px] text-[var(--cs-ink-faded)]">{relativeTime(email.receivedAt)}</span>
      </div>
      <div className="truncate font-[var(--font-doc)] text-[14px] text-[var(--cs-ink)]">{email.subject}</div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {email.markers.invoiceAmountMicros && (
          <span className="cs-tabular rounded-sm border border-[var(--cs-rule)] px-1.5 py-0.5 text-[11px] text-[var(--cs-ink-faded)]">
            {formatUsd(email.markers.invoiceAmountMicros)}
          </span>
        )}
        {email.markers.requestsVendorChange && (
          <span className="rounded-sm border border-[var(--cs-rule)] px-1.5 py-0.5 text-[11px] text-[var(--cs-ink-faded)]">Vendor change</span>
        )}
        {email.markers.hasHiddenText && (
          <span className="rounded-sm border border-[var(--cs-void)] px-1.5 py-0.5 text-[11px] text-[var(--cs-void)]">Hidden text</span>
        )}
        {email.markers.isLookalikeSender && (
          <span className="rounded-sm border border-[var(--cs-void)] px-1.5 py-0.5 text-[11px] text-[var(--cs-void)]">Lookalike domain</span>
        )}

        {glyph && Icon && (
          <span className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: glyph.color }} title={glyph.label}>
            <Icon className="size-3.5" strokeWidth={1.5} />
          </span>
        )}
      </div>
    </button>
  );
}
