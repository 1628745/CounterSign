"use client";

import { motion, useReducedMotion } from "framer-motion";

const STAMP_STYLE = {
  paid: { label: "PAID", color: "var(--cs-paid)" },
  held: { label: "HELD", color: "var(--cs-held)" },
  void: { label: "VOID", color: "var(--cs-void)" },
  declined: { label: "DECLINED", color: "var(--cs-void)" },
  expired: { label: "EXPIRED", color: "var(--cs-ink-faded)" },
} as const;

export type StampValue = keyof typeof STAMP_STYLE;

/** The stamp press — the app's one orchestrated motion moment (docs/DESIGN.md A10, item 1).
 * Keyed by `value` so a later decision (e.g. held -> paid) replays the press on the new stamp. */
export function Stamp({ value }: { value: StampValue }) {
  const reducedMotion = useReducedMotion();
  const style = STAMP_STYLE[value];

  return (
    <motion.div
      key={value}
      initial={reducedMotion ? false : { scale: 1.08, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="inline-block select-none border-2 px-3 py-1 text-[18px] font-extrabold uppercase tracking-wide"
      style={{ color: style.color, borderColor: style.color, transform: "rotate(-4deg)" }}
    >
      {style.label}
    </motion.div>
  );
}
