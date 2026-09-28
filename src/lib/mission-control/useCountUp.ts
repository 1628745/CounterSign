import { useEffect, useRef, useState } from "react";

/** Balance count-up (docs/DESIGN.md A10 item 5) — a plain rAF tween, no dependency needed for a single number. */
export function useCountUp(target: number, durationMs = 600, reducedMotion = false): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion || target === fromRef.current) return;
    const from = fromRef.current;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(from + (target - from) * t);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reducedMotion]);

  return reducedMotion ? target : value;
}
