import assert from "node:assert/strict";
import test from "node:test";
import { spendableClaimedRewardLamports } from "../lib/rewardFunding.ts";

test("spendableClaimedRewardLamports spends the full claim when the wallet already has fee room", () => {
  assert.equal(spendableClaimedRewardLamports(5_000_000, 50_000_000, 20_000_000), 5_000_000);
});

test("spendableClaimedRewardLamports preserves the fee reserve when the claim funds the buffer", () => {
  assert.equal(spendableClaimedRewardLamports(50_000_000, 50_000_000, 20_000_000), 30_000_000);
});

test("spendableClaimedRewardLamports never exposes existing wallet funds", () => {
  assert.equal(spendableClaimedRewardLamports(0, 50_000_000, 20_000_000), 0);
  assert.equal(spendableClaimedRewardLamports(-1_000, 50_000_000, 20_000_000), 0);
  assert.equal(spendableClaimedRewardLamports(5_000_000, 15_000_000, 20_000_000), 0);
});
