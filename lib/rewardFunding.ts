export function spendableClaimedRewardLamports(
  claimedLamports: number,
  walletLamportsAfterClaim: number,
  feeReserveLamports: number
): number {
  if (!Number.isFinite(claimedLamports) || claimedLamports <= 0) return 0;
  if (!Number.isFinite(walletLamportsAfterClaim)) return 0;

  const walletSurplusAboveReserve = Math.max(0, walletLamportsAfterClaim - feeReserveLamports);
  return Math.floor(Math.min(claimedLamports, walletSurplusAboveReserve));
}
