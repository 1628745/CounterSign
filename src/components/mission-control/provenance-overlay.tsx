"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { checkLookalikeSender } from "@/lib/countersign/lookalike";
import { useMissionControlStore } from "@/lib/mission-control/store";

interface LinePosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
}

/**
 * Full-screen provenance thread (docs/DESIGN.md A10 item 3): a bezier line
 * from a traced address to the inbox slip (or wallet row) where it first
 * appeared, void ink for an untrusted source, signature ink for a verified
 * registry entry. Positions are measured from the live DOM (data-cs-address /
 * data-cs-email-id / data-cs-wallet-address) each frame while active, so it
 * tracks correctly through the columns' independent internal scrolling.
 */
export function ProvenanceOverlay() {
  const trace = useMissionControlStore((s) => s.trace);
  const tracedPinned = useMissionControlStore((s) => s.tracedPinned);
  const clearTrace = useMissionControlStore((s) => s.clearTrace);
  const inbox = useMissionControlStore((s) => s.inbox);
  const [pos, setPos] = useState<LinePosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!trace) return;

    function measure() {
      const from = document.querySelector<HTMLElement>(`[data-cs-address="${trace!.address}"]`);
      const targetSelector =
        trace!.firstHit?.source === "email"
          ? `[data-cs-email-id="${trace!.firstHit.emailId}"]`
          : `[data-cs-wallet-address="${trace!.address}"]`;
      const to = document.querySelector<HTMLElement>(targetSelector);
      if (!from || !to) {
        setPos(null);
      } else {
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        setPos({
          x1: fromRect.left + fromRect.width / 2,
          y1: fromRect.top + fromRect.height / 2,
          x2: toRect.left + toRect.width / 2,
          y2: toRect.top + toRect.height / 2,
          labelX: toRect.left,
          labelY: toRect.top,
        });
      }
      rafRef.current = requestAnimationFrame(measure);
    }
    rafRef.current = requestAnimationFrame(measure);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPos(null);
    };
  }, [trace]);

  if (!trace || !pos) return null;

  const untrusted = trace.firstHit?.source !== "registry";
  const color = untrusted ? "var(--cs-void)" : "var(--cs-signature)";

  const email = trace.firstHit?.source === "email" ? inbox.find((e) => e.id === trace.firstHit?.emailId) : undefined;
  const lookalike = email ? checkLookalikeSender(email.fromAddress) : null;

  let note: string;
  if (trace.firstHit?.source === "registry") {
    note = "Verified registry entry.";
  } else if (email) {
    note = lookalike?.isLookalike
      ? `First seen here: email from ${email.fromAddress}, a lookalike of ${lookalike.imitates}.`
      : `First seen here: email from ${email.fromAddress}.`;
  } else {
    note = "No prior occurrence found.";
  }

  const midX = (pos.x1 + pos.x2) / 2;
  const controlY = Math.min(pos.y1, pos.y2) - 60;
  const pathD = `M ${pos.x1},${pos.y1} Q ${midX},${controlY} ${pos.x2},${pos.y2}`;

  return (
    <div className="fixed inset-0 z-40" onClick={() => tracedPinned && clearTrace()} role="presentation">
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          pathLength={1}
          initial={reducedMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </svg>
      <div
        className="pointer-events-none absolute max-w-64 rounded-sm border px-2 py-1.5 text-[12px]"
        style={{
          left: Math.max(8, pos.labelX),
          top: Math.max(8, pos.labelY - 40),
          background: "var(--cs-sheet)",
          borderColor: color,
          color: "var(--cs-ink)",
        }}
      >
        {note}
      </div>
      {tracedPinned && (
        <button
          type="button"
          onClick={clearTrace}
          className="absolute right-4 top-4 flex items-center gap-1 rounded-sm border border-[var(--cs-rule)] bg-[var(--cs-sheet)] px-2 py-1 text-[12px] text-[var(--cs-ink)]"
        >
          <X className="size-3.5" strokeWidth={1.5} />
          Close trace
        </button>
      )}
    </div>
  );
}
