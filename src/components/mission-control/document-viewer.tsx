"use client";

import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { InboxEmailDTO } from "@/lib/mission-control/types";

export interface DocumentViewerProps {
  email: InboxEmailDTO | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mission Control's document viewer (docs/DESIGN.md section A6/A8): a paper
 * sheet in a dialog rendering the attacker-controlled email HTML, sanitized
 * with DOMPurify in an isolated container. Server-annotated
 * data-cs-hidden="<reason>" elements stay invisible by their own original
 * styling until the reveal toggle is on, at which point CSS here overrides
 * exactly those nodes — the sanitizer and the rest of the markup are
 * untouched either way.
 */
export function DocumentViewer({ email, onOpenChange }: DocumentViewerProps) {
  const [revealState, setRevealState] = useState<{ emailId: string | null; revealHidden: boolean }>({ emailId: null, revealHidden: false });
  const [scanning, setScanning] = useState(false);
  const reducedMotion = useReducedMotion();

  const open = email !== null;
  const hasHiddenText = email?.markers.hasHiddenText ?? false;

  // Resetting revealHidden when a different email opens — adjusting state during
  // render (React's endorsed pattern) rather than an effect, since this is a
  // derived reset, not a subscription to an external system.
  if ((email?.id ?? null) !== revealState.emailId) {
    setRevealState({ emailId: email?.id ?? null, revealHidden: false });
  }
  const revealHidden = revealState.revealHidden;

  const sanitizedHtml = useMemo(() => {
    if (!email || typeof window === "undefined") return "";
    return DOMPurify.sanitize(email.html, { ADD_ATTR: ["data-cs-hidden"] });
  }, [email]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "x" && hasHiddenText) {
        e.preventDefault();
        toggleReveal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasHiddenText, revealHidden]);

  function toggleReveal() {
    setRevealState((prev) => {
      const next = !prev.revealHidden;
      if (next && !reducedMotion) {
        setScanning(true);
        setTimeout(() => setScanning(false), 450);
      }
      return { ...prev, revealHidden: next };
    });
  }

  const hiddenStyleTag = useMemo(
    () => (
      <style>{`
        .cs-document.cs-reveal-hidden [data-cs-hidden] {
          display: revert !important;
          visibility: visible !important;
          opacity: 1 !important;
          color: var(--cs-void) !important;
          font-size: 12px !important;
          outline: 1px dashed var(--cs-void);
          background-image: repeating-linear-gradient(45deg, rgba(179,38,30,0.14) 0 4px, transparent 4px 8px);
          padding: 1px 2px;
        }
      `}</style>
    ),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-w-2xl bg-transparent p-0 ring-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{email?.subject ?? "Document"}</DialogTitle>
        {email && (
          <div className="relative">
            {hiddenStyleTag}
            <div
              className={`cs-document relative max-h-[80vh] overflow-y-auto bg-[var(--cs-sheet)] p-8 font-[var(--font-doc)] text-[15px] leading-relaxed text-[var(--cs-ink)] ${
                revealHidden ? "cs-reveal-hidden" : ""
              }`}
              style={{ borderRadius: 2, borderBottom: "1px solid var(--cs-ink-faded)" }}
            >
              <div className="mb-4 flex items-baseline justify-between font-[var(--font-display)] text-[13px] text-[var(--cs-ink-faded)]">
                <div>
                  <div className="font-medium text-[var(--cs-ink)]">
                    {email.fromName} <span className="font-[var(--font-address)]">&lt;{email.fromAddress}&gt;</span>
                  </div>
                  <div>{new Date(email.receivedAt).toLocaleString()}</div>
                </div>
                {hasHiddenText && (
                  <button
                    type="button"
                    onClick={toggleReveal}
                    className="cs-tabular rounded-sm border border-[var(--cs-rule)] px-2 py-1 text-[12px] font-medium text-[var(--cs-ink)] hover:bg-[var(--cs-paper)]"
                  >
                    {revealHidden ? "Hide hidden text" : "Show hidden text"} <span className="text-[var(--cs-ink-faded)]">(X)</span>
                  </button>
                )}
              </div>
              <div className="mb-4 font-[var(--font-display)] text-[18px] font-semibold text-[var(--cs-ink)]">{email.subject}</div>

              <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />

              {revealHidden && (
                <p className="mt-4 border-t border-dashed border-[var(--cs-rule)] pt-2 text-[12px] text-[var(--cs-void)]">
                  Hidden from people. Read by the agent.
                </p>
              )}

              {scanning && (
                <motion.div
                  className="pointer-events-none absolute inset-x-0 h-[2px]"
                  style={{ background: "var(--cs-signature)", top: 0 }}
                  initial={{ top: 0 }}
                  animate={{ top: "100%" }}
                  transition={{ duration: 0.45, ease: "linear" }}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
