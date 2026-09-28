"use client";

import { useMissionControlStore } from "@/lib/mission-control/store";

/** The 1px rule under the guilloche band (docs/DESIGN.md A5/A10, motion budget item 6). */
export function GuardRule() {
  const guardOn = useMissionControlStore((s) => s.guardOn);

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-2 px-4 text-[12px] transition-colors duration-300"
      style={{
        borderTop: `1px solid ${guardOn ? "var(--cs-signature)" : "var(--cs-void)"}`,
        color: "var(--cs-ink-faded)",
        backgroundColor: "var(--cs-paper)",
      }}
    >
      <span className="cs-tabular" style={{ color: guardOn ? "var(--cs-signature)" : "var(--cs-void)" }}>
        {guardOn ? "Guard on" : "Guard off"}
      </span>
      <span>{guardOn ? "Every payment passes through Countersign." : "Payments go straight to the signer."}</span>
    </div>
  );
}
