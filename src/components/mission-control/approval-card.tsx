"use client";

import { formatUsd, relativeTime } from "@/lib/mission-control/format";
import { useNowTick } from "@/lib/mission-control/useNowTick";
import type { PaymentDetailDTO } from "@/lib/mission-control/types";

const EXPIRY_SECONDS = 300;

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, secondsLeft / EXPIRY_SECONDS));
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx={18} cy={18} r={radius} fill="none" stroke="var(--cs-rule)" strokeWidth={2.5} />
      <circle
        cx={18}
        cy={18}
        r={radius}
        fill="none"
        stroke="var(--cs-held)"
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

export function ApprovalCard({ payment }: { payment: PaymentDetailDTO }) {
  const now = useNowTick(1000);
  const { approval, payment: p } = payment;
  if (!approval) return null;

  const secondsLeft = approval.expiresInSeconds ?? Math.max(0, Math.round((new Date(approval.expiresAt).getTime() - now) / 1000));

  return (
    <div
      data-testid="approval-card"
      className="mb-2 flex items-center gap-3 bg-[var(--cs-sheet)] p-3"
      style={{ borderRadius: 16, border: "1px solid var(--cs-rule)" }}
    >
      <CountdownRing secondsLeft={secondsLeft} />
      <div className="min-w-0 flex-1">
        <p className="cs-tabular text-[13px] font-medium text-[var(--cs-ink)]">{formatUsd(p.amountMicros)}</p>
        <p className="truncate text-[12px] text-[var(--cs-ink-faded)]">{approval.bindingMessage}</p>
        <p className="cs-tabular text-[11px] text-[var(--cs-ink-faded)]">Sent to your phone {relativeTime(approval.requestedAt)}</p>
      </div>
    </div>
  );
}
