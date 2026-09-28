import { GuillocheMark } from "@/components/mission-control/guilloche";

/** docs/DESIGN.md A5's empty state — the large faint watermark, use 3 of the guilloche generator. */
export function EmptyState() {
  return (
    <div className="relative flex h-full flex-1 items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <GuillocheMark size={320} seed="countersign-watermark" opacity={0.08} />
      </div>
      <p className="relative max-w-xs text-center text-[14px] text-[var(--cs-ink-faded)]">
        8 emails in the inbox. Pick Guard off or Guard on, then run the inbox.
      </p>
    </div>
  );
}
