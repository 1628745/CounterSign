import { useEffect } from "react";
import { useMissionControlStore } from "./store";

/** docs/DESIGN.md A12 — G/R/P/? are global; X is scoped to the document viewer (handled there). */
export function useKeyboardShortcuts(): void {
  const setGuardOn = useMissionControlStore((s) => s.setGuardOn);
  const runInbox = useMissionControlStore((s) => s.runInbox);
  const togglePresenterMode = useMissionControlStore((s) => s.togglePresenterMode);
  const setShortcutsOpen = useMissionControlStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      switch (e.key) {
        case "g":
        case "G":
          setGuardOn(!useMissionControlStore.getState().guardOn);
          break;
        case "r":
        case "R":
          runInbox();
          break;
        case "p":
        case "P":
          togglePresenterMode();
          break;
        case "?":
          setShortcutsOpen(!useMissionControlStore.getState().shortcutsOpen);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setGuardOn, runInbox, togglePresenterMode, setShortcutsOpen]);
}
