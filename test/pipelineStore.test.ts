import assert from "node:assert/strict";
import test from "node:test";
import { isIntervalDue } from "../lib/schedulerGate.ts";
import type { PipelineRecord } from "../lib/pipelineStore.ts";

function record(overrides: Partial<PipelineRecord>): PipelineRecord {
  return {
    id: "pipeline-id",
    createdAt: "2026-07-02T00:00:00.000Z",
    ownerAddress: null,
    sourceMint: "source-mint",
    sourceWallet: "source-wallet",
    network: "mainnet",
    rules: [],
    intervalMinutes: 5,
    enabled: true,
    claimCreatorFees: false,
    feeMint: null,
    dropThresholdLamports: null,
    encryptedKeypair: { ciphertext: "", iv: "", authTag: "" },
    lastRunAt: "2026-07-02T00:00:00.000Z",
    lastRunStatus: "success",
    lastRunSummary: null,
    lastClaimedLamports: null,
    ...overrides,
  };
}

test("isIntervalDue is due when the pipeline has never run", () => {
  const now = Date.parse("2026-07-02T00:00:00.000Z");
  assert.equal(isIntervalDue(record({ lastRunAt: null }), now), true);
});

test("isIntervalDue is not due before intervalMinutes has elapsed since the last run", () => {
  const now = Date.parse("2026-07-02T00:01:00.000Z"); // 1 minute after lastRunAt
  assert.equal(isIntervalDue(record({ intervalMinutes: 5 }), now), false);
});

test("isIntervalDue is due once intervalMinutes has elapsed since the last run", () => {
  const now = Date.parse("2026-07-02T00:05:00.000Z"); // 5 minutes after lastRunAt
  assert.equal(isIntervalDue(record({ intervalMinutes: 5 }), now), true);
});
