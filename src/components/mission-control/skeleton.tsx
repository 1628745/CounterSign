/** Shaped like the real layout, no spinners, no layout shift (docs/DESIGN.md A11). */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-sm bg-[var(--cs-rule)] opacity-40 ${className ?? ""}`} style={style} />;
}

export function InboxSlipSkeleton() {
  return (
    <div style={{ background: "var(--cs-sheet)", borderRadius: 2, padding: "10px 12px", marginBottom: 8 }}>
      <Skeleton className="mb-1.5 h-3 w-24" />
      <Skeleton className="mb-1.5 h-3.5 w-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function WalletRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--cs-rule)] px-1 py-1.5">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-1 h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-3 w-16 shrink-0" />
    </div>
  );
}
