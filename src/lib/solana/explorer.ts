/** Builds a devnet Solana Explorer link for a transaction signature (SPEC.md section 6). */
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
