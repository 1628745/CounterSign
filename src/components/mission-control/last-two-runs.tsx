"use client";

import { Fragment } from "react";
import { formatUsd } from "@/lib/mission-control/format";
import type { RunMoneyStatDTO } from "@/lib/mission-control/types";

const ROWS: { key: keyof RunMoneyStatDTO; label: string }[] = [
  { key: "stolenMicros", label: "Stolen" },
  { key: "paidMicros", label: "Paid" },
  { key: "heldMicros", label: "Held" },
  { key: "blockedMicros", label: "Blocked" },
];

export function LastTwoRuns({ runs }: { runs: RunMoneyStatDTO[] }) {
  if (runs.length === 0) {
    return <p className="px-1 text-[12px] text-[var(--cs-ink-faded)]">No runs yet.</p>;
  }

  const ordered = [...runs].sort((a) => (a.mode === "naive" ? -1 : 1));

  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 px-1 text-[12px]">
        <span />
        {ordered.map((run) => (
          <span key={run.runId} className="font-medium text-[var(--cs-ink)]">
            {run.mode === "guarded" ? "Guard on" : "Guard off"}
          </span>
        ))}
        {ROWS.map((row) => (
          <Fragment key={row.key}>
            <span className="text-[var(--cs-ink-faded)]">{row.label}</span>
            {ordered.map((run) => (
              <span key={`${row.key}-${run.runId}`} className="cs-tabular text-[var(--cs-ink)]">
                {formatUsd(run[row.key] as string)}
              </span>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
