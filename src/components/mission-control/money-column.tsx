"use client";

import { ApprovalCard } from "@/components/mission-control/approval-card";
import { LastTwoRuns } from "@/components/mission-control/last-two-runs";
import { WalletRow } from "@/components/mission-control/wallet-row";
import { WalletRowSkeleton } from "@/components/mission-control/skeleton";
import { getPendingApprovalPaymentIds } from "@/lib/mission-control/selectors";
import { useMissionControlStore } from "@/lib/mission-control/store";

export function MoneyColumn() {
  const wallets = useMissionControlStore((s) => s.wallets);
  const walletsLoaded = useMissionControlStore((s) => s.walletsLoaded);
  const events = useMissionControlStore((s) => s.events);
  const payments = useMissionControlStore((s) => s.payments);
  const recentRuns = useMissionControlStore((s) => s.recentRuns);

  const treasury = wallets.filter((w) => w.group === "treasury");
  const vendors = wallets.filter((w) => w.group === "vendor");
  const unrecognized = wallets.filter((w) => w.group === "unrecognized");

  const pendingIds = getPendingApprovalPaymentIds(events);
  const pendingPayments = pendingIds.map((id) => payments[id]).filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (!walletsLoaded) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-3" style={{ width: 340 }}>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold text-[var(--cs-ink)]">Money</h2>
          <span className="rounded-sm border border-[var(--cs-rule)] px-1.5 py-0.5 text-[11px] text-[var(--cs-ink-faded)]">mUSDC on devnet</span>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <WalletRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3" style={{ width: 340 }}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold text-[var(--cs-ink)]">Money</h2>
        <span className="rounded-sm border border-[var(--cs-rule)] px-1.5 py-0.5 text-[11px] text-[var(--cs-ink-faded)]">mUSDC on devnet</span>
      </div>

      <div className="mb-3">
        {[...treasury, ...vendors].map((w) => (
          <WalletRow key={w.id} wallet={w} />
        ))}
      </div>

      <div className="mb-3">
        <h3 className="mb-1 px-1 text-[12px] font-medium text-[var(--cs-ink-faded)]">Unrecognized wallets</h3>
        {unrecognized.map((w) => (
          <WalletRow key={w.id} wallet={w} />
        ))}
      </div>

      <div className="mb-3">
        <h3 className="mb-1 px-1 text-[12px] font-medium text-[var(--cs-ink-faded)]">Waiting on you</h3>
        {pendingPayments.length === 0 ? (
          <p className="px-1 text-[12px] text-[var(--cs-ink-faded)]">Nothing waiting.</p>
        ) : (
          pendingPayments.map((p) => <ApprovalCard key={p.payment.paymentId} payment={p} />)
        )}
      </div>

      <div>
        <h3 className="mb-1 px-1 text-[12px] font-medium text-[var(--cs-ink-faded)]">Last two runs</h3>
        <LastTwoRuns runs={recentRuns} />
      </div>
    </div>
  );
}
