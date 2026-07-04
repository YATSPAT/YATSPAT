import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POLL_INTERVAL_MINUTES,
  MAX_POLL_INTERVAL_MINUTES,
  MIN_POLL_INTERVAL_MINUTES,
  nextPollIntervalMinutes,
} from "../lib/adaptivePolling.ts";

test("nextPollIntervalMinutes holds the current interval on the first poll (no prior data)", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: DEFAULT_POLL_INTERVAL_MINUTES,
      claimedLamportsThisPoll: 1_000_000,
      previousClaimedLamports: null,
    }),
    DEFAULT_POLL_INTERVAL_MINUTES
  );
});

test("nextPollIntervalMinutes halves the interval when fees accelerate", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: 20,
      claimedLamportsThisPoll: 2_000_000,
      previousClaimedLamports: 1_000_000,
    }),
    10
  );
});

test("nextPollIntervalMinutes doubles the interval when fees slow down", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: 5,
      claimedLamportsThisPoll: 500_000,
      previousClaimedLamports: 1_000_000,
    }),
    10
  );
});

test("nextPollIntervalMinutes holds steady when this poll matches the last", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: 5,
      claimedLamportsThisPoll: 1_000_000,
      previousClaimedLamports: 1_000_000,
    }),
    5
  );
});

test("nextPollIntervalMinutes never goes below the 1-minute floor", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: MIN_POLL_INTERVAL_MINUTES,
      claimedLamportsThisPoll: 2,
      previousClaimedLamports: 1,
    }),
    MIN_POLL_INTERVAL_MINUTES
  );
});

test("nextPollIntervalMinutes never exceeds the 60-minute ceiling", () => {
  assert.equal(
    nextPollIntervalMinutes({
      currentIntervalMinutes: MAX_POLL_INTERVAL_MINUTES,
      claimedLamportsThisPoll: 1,
      previousClaimedLamports: 2,
    }),
    MAX_POLL_INTERVAL_MINUTES
  );
});

test("nextPollIntervalMinutes converges to the ceiling quickly via doubling, not decades of linear steps", () => {
  let interval = DEFAULT_POLL_INTERVAL_MINUTES;
  let previous = 1_000_000;
  let thisPoll = 500_000; // strictly decreasing each poll, so every step doubles
  for (let i = 0; i < 5; i++) {
    interval = nextPollIntervalMinutes({
      currentIntervalMinutes: interval,
      claimedLamportsThisPoll: thisPoll,
      previousClaimedLamports: previous,
    });
    previous = thisPoll;
    thisPoll -= 1;
  }
  assert.equal(interval, MAX_POLL_INTERVAL_MINUTES); // 5 -> 10 -> 20 -> 40 -> 60 (capped) -> 60
});
