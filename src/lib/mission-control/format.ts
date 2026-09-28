/**
 * The UI-facing money boundary (SPEC.md non-negotiable #4): every amount
 * arrives here as a bigint-in-a-string micro-unit; this is the only place
 * that divides by 1e6 and formats dollars.
 */
export function formatUsd(micros: bigint | string | number): string {
  const value = typeof micros === "bigint" ? micros : BigInt(Math.round(Number(micros)));
  const dollars = Number(value) / 1_000_000;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function shortAddress(address: string): string {
  return address.length <= 10 ? address : `${address.slice(0, 4)}..${address.slice(-4)}`;
}

export function formatTime(ts: string | Date): string {
  const date = typeof ts === "string" ? new Date(ts) : ts;
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function relativeTime(ts: string | Date, now: number = Date.now()): string {
  const date = typeof ts === "string" ? new Date(ts) : ts;
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
