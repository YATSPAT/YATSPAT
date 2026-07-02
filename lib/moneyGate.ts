export const SOL_RESERVE_LAMPORTS = 20_000_000; // 0.02 SOL
export const MIN_SOL_DROP_LAMPORTS = 500_000_000; // 0.5 SOL

export function spendableWalletSolLamports(
  walletLamports: number,
  reserveLamports: number = SOL_RESERVE_LAMPORTS
): number {
  if (!Number.isFinite(walletLamports) || !Number.isFinite(reserveLamports)) return 0;
  return Math.max(0, Math.floor(walletLamports - reserveLamports));
}

export function shouldDropWalletSol(
  spendableLamports: number,
  thresholdLamports: number = MIN_SOL_DROP_LAMPORTS
): boolean {
  return Number.isFinite(spendableLamports) && spendableLamports >= thresholdLamports;
}

export function sol(lamports: number): string {
  return (lamports / 1e9).toFixed(6);
}
