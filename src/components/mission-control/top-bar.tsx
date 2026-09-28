"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuillocheBand, GuillocheMark } from "@/components/mission-control/guilloche";
import { useMissionControlStore } from "@/lib/mission-control/store";
import { toast } from "@/components/ui/toast";

export type MissionControlTab = "mission-control" | "attack-lab" | "ledger" | "under-the-hood";

const TABS: { value: MissionControlTab; label: string }[] = [
  { value: "mission-control", label: "Mission Control" },
  { value: "attack-lab", label: "Attack Lab" },
  { value: "ledger", label: "Ledger" },
  { value: "under-the-hood", label: "Under the hood" },
];

export interface TopBarProps {
  userName: string;
  activeTab: MissionControlTab;
  onTabChange: (tab: MissionControlTab) => void;
}

export function TopBar({ userName, activeTab, onTabChange }: TopBarProps) {
  const guardOn = useMissionControlStore((s) => s.guardOn);
  const setGuardOn = useMissionControlStore((s) => s.setGuardOn);
  const runStatus = useMissionControlStore((s) => s.runStatus);
  const runInbox = useMissionControlStore((s) => s.runInbox);
  const resetDemo = useMissionControlStore((s) => s.resetDemo);

  const running = runStatus === "running";

  async function handleRunInbox() {
    if (running) return;
    await runInbox();
    toast.add({ title: "Inbox run started" });
  }

  async function handleResetDemo() {
    await resetDemo();
    toast.add({ title: "Demo reset" });
  }

  return (
    <header className="shrink-0">
      <div className="flex h-14 items-center gap-6 border-b border-[var(--cs-rule)] bg-[var(--cs-sheet)] px-4">
        <div className="flex items-center gap-2">
          <GuillocheMark size={20} seed="countersign-logo" />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--cs-ink)]">Countersign</span>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as MissionControlTab)}>
          <TabsList variant="line">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-[13px]">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--cs-ink)]">
            <span>{guardOn ? "Guard on" : "Guard off"}</span>
            <Switch checked={guardOn} onCheckedChange={(v) => setGuardOn(Boolean(v))} disabled={running} aria-label="Toggle guard" />
          </label>

          <Button size="sm" onClick={handleRunInbox} disabled={running}>
            {running ? "Running…" : "Run inbox"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetDemo} disabled={running}>
            Reset demo
          </Button>

          <span className="cs-tabular rounded-sm border border-[var(--cs-rule)] px-2 py-0.5 text-[12px] font-medium text-[var(--cs-ink-faded)]">
            devnet
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>{userName}</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{userName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href="/auth/logout" />} className="flex items-center gap-2">
                <LogOut className="size-3.5" strokeWidth={1.5} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <GuillocheBand />
    </header>
  );
}
