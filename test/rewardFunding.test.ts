import assert from "node:assert/strict";
import test from "node:test";
import { spendableClaimedRewardLamports } from "../lib/rewardFunding.ts";

test("spendableClaimedRewardLamports only exposes claimed rewards above the fee reserve", () => {
  assert.equal(spendableClaimedRewardLamports(50_000_000, 20_000_000), 30_000_000);
});

test("spendableClaimedRewardLamports never exposes existing wallet funds when claim is empty or fee-sized", () => {
  assert.equal(spendableClaimedRewardLamports(0, 20_000_000), 0);
  assert.equal(spendableClaimedRewardLamports(20_000_000, 20_000_000), 0);
  assert.equal(spendableClaimedRewardLamports(-1_000, 20_000_000), 0);
});
