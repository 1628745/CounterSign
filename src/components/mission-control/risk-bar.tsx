"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { familyForSignal } from "@/lib/mission-control/signalFamilies";
import type { Signal } from "@/lib/countersign/types";

const FAMILY_COLOR: Record<string, string> = {
  provenance: "var(--cs-family-provenance)",
  history: "var(--cs-family-history)",
  content: "var(--cs-family-content)",
};

const SCALE_MAX = 150;
const APPROVAL_TICK = 30;
const BLOCK_TICK = 110;

const HARD_BLOCK_KEYS = new Set(["duplicate_invoice", "hidden_only_payee"]);

export interface RiskBarProps {
  score: number;
  signals: Signal[];
}

/** docs/DESIGN.md section A9 — one segment per fired signal, width = weight, colored by family; ticks at 30/110. */
export function RiskBar({ score, signals }: RiskBarProps) {
  const fired = signals.filter((s) => s.fired && !HARD_BLOCK_KEYS.has(s.key)).sort((a, b) => b.weight - a.weight);
  const hardBlocks = signals.filter((s) => s.fired && HARD_BLOCK_KEYS.has(s.key));

  const pct = (value: number) => `${Math.min(100, (value / SCALE_MAX) * 100)}%`;

  return (
    <div className="mt-2">
      <div className="relative h-4 w-full overflow-hidden rounded-sm bg-[var(--cs-paper)]" style={{ border: "1px solid var(--cs-rule)" }}>
        <div className="absolute inset-y-0 left-0 flex" style={{ width: pct(score) }}>
          {fired.map((signal) => (
            <Tooltip key={signal.key}>
              <TooltipTrigger
                render={<span />}
                className="h-full"
                style={{ width: pct(signal.weight), backgroundColor: FAMILY_COLOR[familyForSignal(signal.key)] }}
              />
              <TooltipContent side="top" className="max-w-64 text-[12px]">
                <p className="font-medium">{signal.label}</p>
                <p>{signal.evidence.sentence}</p>
                {signal.query && <p className="cs-tabular mt-1 text-[11px] opacity-80">{signal.query}</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {hardBlocks.length > 0 && (
          <Tooltip>
            <TooltipTrigger render={<span />} className="absolute inset-y-0 right-0 w-2" style={{ backgroundColor: "var(--cs-void)" }} />
            <TooltipContent side="top" className="max-w-64 text-[12px]">
              {hardBlocks.map((s) => (
                <p key={s.key}>{s.evidence.sentence}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
        <div className="absolute inset-y-0 w-px bg-[var(--cs-ink-faded)]" style={{ left: pct(APPROVAL_TICK) }} />
        <div className="absolute inset-y-0 w-px bg-[var(--cs-ink-faded)]" style={{ left: pct(BLOCK_TICK) }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-[var(--cs-ink-faded)]">
        <span className="cs-tabular">0</span>
        <span className="cs-tabular" style={{ marginLeft: `calc(${pct(APPROVAL_TICK)} - 3ch)` }}>
          30 (ask a human)
        </span>
        <span className="cs-tabular">Score: {score}</span>
      </div>
    </div>
  );
}
