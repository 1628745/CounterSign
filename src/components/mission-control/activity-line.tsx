"use client";

import { formatTime } from "@/lib/mission-control/format";
import { describeEvent, getDisclosurePayloads, type EventCopyContext } from "@/lib/mission-control/eventCopy";
import { useMissionControlStore } from "@/lib/mission-control/store";

export function ActivityLine({ ctx }: { ctx: EventCopyContext }) {
  const presenterMode = useMissionControlStore((s) => s.presenterMode);
  const event = ctx.events[ctx.index];
  const sentence = describeEvent(ctx);
  if (!sentence) return null;

  const disclosure = presenterMode ? [] : getDisclosurePayloads(ctx);
  const isAgentMessage = event.kind === "agent_message";
  const isError = event.kind === "error";

  return (
    <div className="flex gap-3 py-1 text-[13px]" style={isError ? { color: "var(--cs-void)" } : undefined}>
      <span className="cs-tabular w-16 shrink-0 text-[var(--cs-ink-faded)]">{formatTime(event.ts)}</span>
      <div className="min-w-0 flex-1">
        <p className={isAgentMessage ? "italic text-[var(--cs-ink-faded)]" : "text-[var(--cs-ink)]"}>{sentence}</p>
        {disclosure.length > 0 && (
          <details className="mt-0.5">
            <summary className="cursor-pointer text-[11px] text-[var(--cs-ink-faded)]">raw</summary>
            <pre className="mt-1 max-w-full overflow-x-auto rounded-sm bg-[var(--cs-sheet)] p-2 font-[var(--font-address)] text-[11px] text-[var(--cs-ink-faded)]">
              {disclosure.map((d) => `${d.label}: ${JSON.stringify(d.payload, null, 2)}`).join("\n\n")}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
