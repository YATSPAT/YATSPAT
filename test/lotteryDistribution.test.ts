import assert from "node:assert/strict";
import test from "node:test";
import {
  MISSING_ATA_RECIPIENT_COST_LAMPORTS,
  planLotteryDistribution,
} from "../lib/lotteryDistribution.ts";

test("planLotteryDistribution is deterministic for the same seed", () => {
  const candidates = Array.from({ length: 20 }, (_, index) => ({
    address: `holder-${index}`,
    balanceRaw: BigInt(index + 1),
    hasTargetAta: index % 2 === 0,
  }));

  const first = planLotteryDistribution({
    candidates,
    poolLamports: 100_000_000,
    seed: "same-seed",
  });
  const second = planLotteryDistribution({
    candidates,
    poolLamports: 100_000_000,
    seed: "same-seed",
  });

  assert.deepEqual(
    first?.recipients.map((recipient) => recipient.address),
    second?.recipients.map((recipient) => recipient.address)
  );
});

test("planLotteryDistribution prioritizes existing token accounts to maximize holder count", () => {
  const candidates = [
    ...Array.from({ length: 3 }, (_, index) => ({
      address: `missing-${index}`,
      balanceRaw: 1n,
      hasTargetAta: false,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      address: `existing-${index}`,
      balanceRaw: 1n,
      hasTargetAta: true,
    })),
  ];

  const plan = planLotteryDistribution({
    candidates,
    poolLamports: 3_000_000,
    seed: "prefer-existing",
  });

  assert.ok(plan);
  assert.equal(plan.recipients.length, 10);
  assert.equal(plan.ataExistingCount, 10);
  assert.equal(plan.ataMissingCount, 0);
});

test("planLotteryDistribution uses remaining budget for missing token accounts", () => {
  const candidates = Array.from({ length: 500 }, (_, index) => ({
    address: `holder-${index}`,
    balanceRaw: 1n,
    hasTargetAta: false,
  }));

  const plan = planLotteryDistribution({
    candidates,
    poolLamports: 500_000_000,
    seed: "missing-ata-budget",
  });

  assert.ok(plan);
  assert.equal(plan.recipients.length, Math.floor((500_000_000 - 2_100_000) / MISSING_ATA_RECIPIENT_COST_LAMPORTS));
});
