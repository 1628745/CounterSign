"use client";

import { X } from "lucide-react";
import { useMissionControlStore } from "@/lib/mission-control/store";

/** docs/DESIGN.md A11 — say what happened and how it resolves, not a generic failure toast. */
export function ErrorBanner() {
  const error = useMissionControlStore((s) => s.error);
  const clearError = useMissionControlStore((s) => s.clearError);
  if (!error) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-1.5 text-[13px]"
      style={{ background: "var(--cs-sheet)", borderBottom: "1px solid var(--cs-void)", color: "var(--cs-void)" }}
      role="alert"
    >
      <span>{error}</span>
      <button type="button" onClick={clearError} aria-label="Dismiss">
        <X className="size-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
