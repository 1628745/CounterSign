"use client";

import { ExternalLink } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { formatTime } from "@/lib/mission-control/format";

export interface CountersignatureProps {
  approverName: string;
  resolvedAt: string;
  explorerUrl: string | null;
  elapsedSeconds: number | null;
}

/** docs/DESIGN.md A10 item 2 — script wipe, 700ms, then the confirmation line and explorer link. */
export function Countersignature({ approverName, resolvedAt, explorerUrl, elapsedSeconds }: CountersignatureProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="mt-2 text-[13px] text-[var(--cs-ink-faded)]">
      <div className="flex items-baseline gap-2">
        <span>Countersigned by</span>
        <motion.span
          className="text-[24px] text-[var(--cs-signature)]"
          style={{ fontFamily: "var(--font-script)" }}
          initial={reducedMotion ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 0.7 }}
        >
          {approverName}
        </motion.span>
        <span>
          in Auth0 Guardian at <span className="cs-tabular">{formatTime(resolvedAt)}</span>
        </span>
      </div>
      {explorerUrl && <TxConfirmation elapsedSeconds={elapsedSeconds} explorerUrl={explorerUrl} className="mt-1" />}
    </div>
  );
}

/** The bare confirmation line for auto_pay/naive payments — no human, so no countersignature phrase. */
export function TxConfirmation({
  elapsedSeconds,
  explorerUrl,
  className,
}: {
  elapsedSeconds: number | null;
  explorerUrl: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="cs-tabular text-[13px] text-[var(--cs-ink-faded)]">
        Confirmed on Solana in {elapsedSeconds !== null ? elapsedSeconds.toFixed(1) : "0.0"}s.
      </p>
      <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-[var(--cs-signature)] underline">
        View on Solana Explorer
        <ExternalLink className="size-3" strokeWidth={1.5} />
      </a>
    </div>
  );
}
