"use client";

import { useMissionControlStore } from "@/lib/mission-control/store";

/** docs/DESIGN.md A5 — one aria-live region, announcing each decision in one sentence. */
export function AriaLiveAnnouncer() {
  const announcement = useMissionControlStore((s) => s.announcement);
  return (
    <div aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}
