"use client";

import { useEffect, useState } from "react";
import { AgentActivityColumn } from "@/components/mission-control/agent-activity-column";
import { AriaLiveAnnouncer } from "@/components/mission-control/aria-live-announcer";
import { ErrorBanner } from "@/components/mission-control/error-banner";
import { GuardRule } from "@/components/mission-control/guard-rule";
import { InboxColumn } from "@/components/mission-control/inbox-column";
import { MoneyColumn } from "@/components/mission-control/money-column";
import { ProvenanceOverlay } from "@/components/mission-control/provenance-overlay";
import { ShortcutsHelp } from "@/components/mission-control/shortcuts-help";
import { TopBar, type MissionControlTab } from "@/components/mission-control/top-bar";
import { Toaster } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/lib/mission-control/useKeyboardShortcuts";
import { useMissionControlStore } from "@/lib/mission-control/store";

function NotBuiltYet({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-[14px] text-[var(--cs-ink-faded)]">{label} isn&apos;t built yet.</div>
  );
}

export function MissionControlApp({ userName }: { userName: string }) {
  const [activeTab, setActiveTab] = useState<MissionControlTab>("mission-control");
  const presenterMode = useMissionControlStore((s) => s.presenterMode);
  const loadInbox = useMissionControlStore((s) => s.loadInbox);
  const fetchWallets = useMissionControlStore((s) => s.fetchWallets);
  const setApproverName = useMissionControlStore((s) => s.setApproverName);
  const startApprovalWatcher = useMissionControlStore((s) => s.startApprovalWatcher);

  useKeyboardShortcuts();

  useEffect(() => {
    setApproverName(userName);
    loadInbox();
    fetchWallets();
    // Runs for the lifetime of the page — a human approving on their phone routinely
    // takes longer than the agent's own run, so this must outlive any single run.
    startApprovalWatcher();
    // Runs once on mount — these are stable store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-cs-app="mission-control" className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--cs-paper)" }}>
      <TopBar userName={userName} activeTab={activeTab} onTabChange={setActiveTab} />
      <ErrorBanner />
      <GuardRule />
      <div className="flex flex-1 overflow-hidden" style={{ zoom: presenterMode ? 1.15 : 1 } as React.CSSProperties}>
        {activeTab === "mission-control" ? (
          <>
            <InboxColumn />
            <div className="w-px shrink-0 bg-[var(--cs-rule)]" />
            <AgentActivityColumn />
            <div className="w-px shrink-0 bg-[var(--cs-rule)]" />
            <MoneyColumn />
          </>
        ) : (
          <NotBuiltYet label={activeTab === "attack-lab" ? "Attack Lab" : activeTab === "ledger" ? "Ledger" : "Under the hood"} />
        )}
      </div>

      <ProvenanceOverlay />
      <AriaLiveAnnouncer />
      <ShortcutsHelp />
      <Toaster />
    </div>
  );
}
