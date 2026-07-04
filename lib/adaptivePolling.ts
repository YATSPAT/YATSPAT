export const MIN_POLL_INTERVAL_MINUTES = 1;
export const MAX_POLL_INTERVAL_MINUTES = 60;
export const DEFAULT_POLL_INTERVAL_MINUTES = 5;

function clamp(minutes: number): number {
  return Math.max(MIN_POLL_INTERVAL_MINUTES, Math.min(MAX_POLL_INTERVAL_MINUTES, Math.round(minutes)));
}

/* ── Adaptive fee-collection polling ─────────────────────────────────
   Each pipeline starts checking for collectible creator fees every 5 minutes.
   Comparing this poll's collected amount to the previous poll's is a simple
   proxy for "is fee activity picking up or fading" — react by halving/doubling
   rather than a slow linear step, so the interval actually converges to the
   right cadence within a few polls instead of dozens. Bounded to [1, 60] min
   so a busy pipeline never gets checked more than once a minute, and a quiet
   one never waits more than an hour. */
export function nextPollIntervalMinutes(input: {
  currentIntervalMinutes: number;
  claimedLamportsThisPoll: number;
  previousClaimedLamports: number | null;
}): number {
  const { currentIntervalMinutes, claimedLamportsThisPoll, previousClaimedLamports } = input;
  // No prior poll to compare against (first poll ever) — hold at the current interval.
  if (previousClaimedLamports === null) return clamp(currentIntervalMinutes);
  if (claimedLamportsThisPoll > previousClaimedLamports) return clamp(currentIntervalMinutes / 2);
  if (claimedLamportsThisPoll < previousClaimedLamports) return clamp(currentIntervalMinutes * 2);
  return clamp(currentIntervalMinutes);
}
