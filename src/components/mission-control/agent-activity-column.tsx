"use client";

import { useEffect, useRef } from "react";
import { ActivityLine } from "@/components/mission-control/activity-line";
import { DecisionCard } from "@/components/mission-control/decision-card";
import { EmptyState } from "@/components/mission-control/empty-state";
import { useMissionControlStore } from "@/lib/mission-control/store";

export function AgentActivityColumn() {
  const events = useMissionControlStore((s) => s.events);
  const runStatus = useMissionControlStore((s) => s.runStatus);
  const runSummary = useMissionControlStore((s) => s.runSummary);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  if (events.length === 0 && runStatus === "idle") {
    return (
      <div className="flex h-full flex-1 flex-col overflow-y-auto p-3">
        <h2 className="mb-2 px-1 text-[13px] font-semibold text-[var(--cs-ink)]">Agent activity</h2>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto p-3">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-[var(--cs-ink)]">Agent activity</h2>
      {events.map((event, index) => (
        <div key={event.seq}>
          <ActivityLine ctx={{ events, index }} />
          {event.kind === "payment_proposed" && event.paymentId && <DecisionCard paymentId={event.paymentId} />}
        </div>
      ))}
      {runStatus === "completed" && (
        <div className="mt-2 rounded-sm border border-[var(--cs-rule)] bg-[var(--cs-sheet)] p-3 text-[13px] text-[var(--cs-ink)]">
          <span className="font-semibold">Run finished.</span> {runSummary}
        </div>
      )}
      {runStatus === "failed" && (
        <div className="mt-2 rounded-sm border border-[var(--cs-void)] bg-[var(--cs-sheet)] p-3 text-[13px]" style={{ color: "var(--cs-void)" }}>
          The run failed. Check the raw events above for details.
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
