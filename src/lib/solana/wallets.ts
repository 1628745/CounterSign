/**
 * Public keys only (no secrets) for the demo wallets, loaded from the
 * committed data/wallets.json (SPEC.md section 6). Secret keys live only
 * in .env.local and are read exclusively by ./signer.ts.
 *
 * TODO(solana prompt): implement, typed against data/wallets.json's shape.
 */
export interface WalletDirectory {
  treasury: string;
  vendors: {
    blueRidge: string;
    chesapeake: string;
    colonial: string;
  };
  attackers: {
    attackerA: string;
    attackerB: string;
  };
}

export function loadWalletDirectory(): WalletDirectory {
  throw new Error("TODO: implement loadWalletDirectory — see SPEC.md section 6");
}
