"use client";

import { useReducedMotion } from "framer-motion";
import { formatUsd, shortAddress } from "@/lib/mission-control/format";
import { useCountUp } from "@/lib/mission-control/useCountUp";
import type { WalletDTO } from "@/lib/mission-control/types";

export function WalletRow({ wallet }: { wallet: WalletDTO }) {
  const reducedMotion = useReducedMotion();
  const dollars = Number(wallet.musdcMicros) / 1_000_000;
  const displayed = useCountUp(dollars, 600, Boolean(reducedMotion));
  const stolen = wallet.group === "unrecognized" && dollars > 0;

  return (
    <div
      data-cs-wallet-address={wallet.address}
      className="flex items-center justify-between gap-2 border-b border-[var(--cs-rule)] px-1 py-1.5"
    >
      <div className="min-w-0">
        <div className="truncate text-[13px]" style={{ color: stolen ? "var(--cs-void)" : "var(--cs-ink)" }}>
          {wallet.label}
        </div>
        <div className="font-[var(--font-address)] text-[11px] text-[var(--cs-ink-faded)]">{shortAddress(wallet.address)}</div>
      </div>
      <div className="cs-tabular shrink-0 text-[13px] font-medium" style={{ color: stolen ? "var(--cs-void)" : "var(--cs-ink)" }}>
        {stolen ? `Stolen ${formatUsd(Math.round(displayed * 1_000_000))}` : formatUsd(Math.round(displayed * 1_000_000))}
      </div>
    </div>
  );
}
