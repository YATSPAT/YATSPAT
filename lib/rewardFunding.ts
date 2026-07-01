export function spendableClaimedRewardLamports(claimedLamports: number, feeReserveLamports: number): number {
  if (!Number.isFinite(claimedLamports) || claimedLamports <= feeReserveLamports) return 0;
  return Math.floor(claimedLamports - feeReserveLamports);
}
