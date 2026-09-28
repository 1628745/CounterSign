/**
 * Procedural guilloche rosette (docs/DESIGN.md section A4) — layered
 * hypotrochoid curves, thin rule-colored strokes, no fill. Seeded so the
 * same `seed` always renders the same rosette (not random per mount); used
 * in exactly three places in the product, all three sizes of this one
 * generator: the 20px logo mark, a tiled 6px band under the top bar, and a
 * large faint watermark in empty states.
 */

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hypotrochoidPath(R: number, r: number, d: number, cycles: number, steps: number): string {
  const points: string[] = [];
  const total = Math.PI * 2 * cycles;
  for (let i = 0; i <= steps; i++) {
    const t = (total * i) / steps;
    const ratio = (R - r) / r;
    const x = (R - r) * Math.cos(t) + d * Math.cos(ratio * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(ratio * t);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function rosetteLayers(seed: string): { r: number; d: number; cycles: number }[] {
  const rand = mulberry32(hashSeed(seed));
  return [0, 1, 2].map((layer) => ({
    r: 6 + rand() * 8 + layer * 2,
    d: 12 + rand() * 16,
    cycles: 5 + Math.floor(rand() * 4),
  }));
}

function RosettePaths({ seed, outerR = 42 }: { seed: string; outerR?: number }) {
  return (
    <>
      <circle cx={0} cy={0} r={outerR + 6} fill="none" stroke="var(--cs-rule)" strokeWidth={0.5} />
      {rosetteLayers(seed).map((layer, i) => (
        <path key={i} d={hypotrochoidPath(outerR, layer.r, layer.d, layer.cycles, 360)} fill="none" stroke="var(--cs-rule)" strokeWidth={0.75} />
      ))}
    </>
  );
}

export interface GuillocheMarkProps {
  size: number;
  seed?: string;
  className?: string;
  opacity?: number;
}

/** Use 1 (20px logo mark) and use 3 (large faint watermark) — same generator, different size/opacity. */
export function GuillocheMark({ size, seed = "countersign", className, opacity = 1 }: GuillocheMarkProps) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className={className} aria-hidden="true" style={{ opacity }}>
      <RosettePaths seed={seed} />
    </svg>
  );
}

/** Use 2: the 6px-tall band under the top bar, tiling the same rosette full width. */
export function GuillocheBand({ className, seed = "countersign-band" }: { className?: string; seed?: string }) {
  const tileId = `cs-guilloche-tile-${seed}`;
  return (
    <svg width="100%" height={6} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id={tileId} width={24} height={6} patternUnits="userSpaceOnUse" viewBox="-50 -50 100 100">
          <rect x={-50} y={-50} width={100} height={100} fill="var(--cs-sheet)" />
          <RosettePaths seed={seed} outerR={46} />
        </pattern>
      </defs>
      <rect x={0} y={0} width="100%" height={6} fill={`url(#${tileId})`} />
    </svg>
  );
}
