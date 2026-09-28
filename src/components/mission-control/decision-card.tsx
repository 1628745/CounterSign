"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Countersignature, TxConfirmation } from "@/components/mission-control/countersignature";
import { RiskBar } from "@/components/mission-control/risk-bar";
import { Stamp, type StampValue } from "@/components/mission-control/stamp";
import { formatUsd, shortAddress } from "@/lib/mission-control/format";
import { getTxElapsedSeconds } from "@/lib/mission-control/selectors";
import { useMissionControlStore } from "@/lib/mission-control/store";
import type { PaymentDetailDTO } from "@/lib/mission-control/types";

function stampValueFor(payment: PaymentDetailDTO["payment"]): StampValue | null {
  switch (payment.decision) {
    case "naive_paid":
    case "auto_pay":
    case "approved":
      return "paid";
    case "approval_pending":
      return "held";
    case "denied":
      return "declined";
    case "expired":
      return "expired";
    case "blocked":
      return "void";
    default:
      return null;
  }
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="text-[var(--cs-ink-faded)] hover:text-[var(--cs-ink)]"
      aria-label="Copy address"
    >
      {copied ? <Check className="size-3.5" strokeWidth={1.5} /> : <Copy className="size-3.5" strokeWidth={1.5} />}
    </button>
  );
}

export function DecisionCard({ paymentId }: { paymentId: string }) {
  const payment = useMissionControlStore((s) => s.payments[paymentId]);
  const wallets = useMissionControlStore((s) => s.wallets);
  const events = useMissionControlStore((s) => s.events);
  const approverName = useMissionControlStore((s) => s.approverName);
  const hoverTrace = useMissionControlStore((s) => s.hoverTrace);
  const unhoverTrace = useMissionControlStore((s) => s.unhoverTrace);
  const pinTrace = useMissionControlStore((s) => s.pinTrace);

  if (!payment) {
    return (
      <div className="my-2 animate-pulse rounded-[6px] border-l-[3px] border-[var(--cs-rule)] bg-[var(--cs-sheet)] p-3" style={{ height: 88 }} />
    );
  }

  const { payment: p, risk, approval } = payment;
  const wallet = wallets.find((w) => w.address === p.payeeAddress);
  const payeeLabel = wallet ? wallet.label : "Unknown wallet";
  const stampValue = stampValueFor(p);
  const elapsedSeconds = getTxElapsedSeconds(paymentId, events);

  const stampInk = stampValue === "paid" ? "var(--cs-paid)" : stampValue === "held" ? "var(--cs-held)" : stampValue ? "var(--cs-void)" : "var(--cs-rule)";

  const topReasons = risk
    ? risk.signals
        .filter((s) => s.fired)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((s) => s.evidence.sentence)
    : [];

  return (
    <div className="my-2 rounded-[6px] bg-[var(--cs-sheet)] p-3" style={{ borderLeft: `3px solid ${stampInk}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="cs-tabular text-[24px] font-semibold text-[var(--cs-ink)]">{formatUsd(p.amountMicros)}</div>
          <div className="text-[13px] text-[var(--cs-ink)]">to {payeeLabel}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--cs-ink-faded)]">
            <span
              data-cs-address={p.payeeAddress}
              className={risk ? "font-[var(--font-address)] cursor-pointer underline-offset-2 hover:underline" : "font-[var(--font-address)]"}
              onMouseEnter={risk ? () => hoverTrace({ address: p.payeeAddress, firstHit: risk.provenance.hits[0] ?? null }) : undefined}
              onMouseLeave={risk ? unhoverTrace : undefined}
              onFocus={risk ? () => hoverTrace({ address: p.payeeAddress, firstHit: risk.provenance.hits[0] ?? null }) : undefined}
              onBlur={risk ? unhoverTrace : undefined}
              tabIndex={risk ? 0 : undefined}
            >
              {shortAddress(p.payeeAddress)}
            </span>
            <CopyAddressButton address={p.payeeAddress} />
            {p.invoiceNumber && <span className="ml-2">{p.invoiceNumber}</span>}
          </div>
        </div>
        {stampValue && <Stamp value={stampValue} />}
      </div>

      {risk && <RiskBar score={risk.score} signals={risk.signals} />}

      {approval && approval.status === "pending" && (
        <p className="cs-tabular mt-2 text-[13px]" style={{ color: "var(--cs-held)" }}>
          Waiting on you — expires in {approval.expiresInSeconds ?? "…"}s.
        </p>
      )}

      {approval?.status === "approved" && p.decision === "approved" && (
        <Countersignature
          approverName={approverName || "the approver"}
          resolvedAt={approval.resolvedAt ?? p.ts}
          explorerUrl={p.explorerUrl}
          elapsedSeconds={elapsedSeconds}
        />
      )}

      {!approval && (p.decision === "naive_paid" || p.decision === "auto_pay") && p.explorerUrl && (
        <TxConfirmation elapsedSeconds={elapsedSeconds} explorerUrl={p.explorerUrl} className="mt-2" />
      )}

      {topReasons.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-[var(--cs-ink-faded)]">
          {topReasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}

      {risk && (
        <button
          type="button"
          onClick={() => pinTrace({ address: p.payeeAddress, firstHit: risk.provenance.hits[0] ?? null })}
          className="mt-2 text-[12px] text-[var(--cs-signature)] underline"
        >
          Trace this address
        </button>
      )}
    </div>
  );
}
