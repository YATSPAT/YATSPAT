import assert from "node:assert/strict";
import test from "node:test";
import { spendableWalletSolLamports, shouldDropWalletSol } from "../lib/moneyGate.ts";

test("spendableWalletSolLamports leaves the fee reserve untouched", () => {
  assert.equal(spendableWalletSolLamports(39_999_999, 20_000_000), 19_999_999);
  assert.equal(spendableWalletSolLamports(20_000_000, 20_000_000), 0);
  assert.equal(spendableWalletSolLamports(10_000_000, 20_000_000), 0);
});

test("shouldDropWalletSol requires spendable SOL above the money threshold", () => {
  assert.equal(shouldDropWalletSol(499_999_999), false);
  assert.equal(shouldDropWalletSol(500_000_000), true);
});
