"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMissionControlStore } from "@/lib/mission-control/store";

const SHORTCUTS: { key: string; description: string }[] = [
  { key: "G", description: "Toggle guard on/off" },
  { key: "R", description: "Run inbox" },
  { key: "X", description: "Toggle hidden text (document open)" },
  { key: "P", description: "Toggle presenter mode" },
  { key: "?", description: "Show this list" },
];

export function ShortcutsHelp() {
  const open = useMissionControlStore((s) => s.shortcutsOpen);
  const setOpen = useMissionControlStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xs">
        <DialogTitle className="text-[15px] font-semibold text-[var(--cs-ink)]">Keyboard shortcuts</DialogTitle>
        <ul className="mt-2 space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-[13px] text-[var(--cs-ink)]">
              <span
                className="cs-tabular flex h-6 min-w-6 items-center justify-center rounded-sm border border-[var(--cs-rule)] px-1.5 font-medium"
                style={{ background: "var(--cs-paper)" }}
              >
                {s.key}
              </span>
              <span>{s.description}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
