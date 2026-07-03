import assert from "node:assert/strict";
import test from "node:test";
import { isCronEligible } from "../lib/schedulerGate.ts";
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
    ...overrides,
  };
}

test("isCronEligible ignores interval timing for money-based source mints", () => {
  const now = Date.parse("2026-07-02T00:01:00.000Z");
  assert.equal(
    isCronEligible(record({ sourceMint: "SOL", intervalMinutes: 5 }), now, new Set(["SOL"])),
    true
  );
});

test("isCronEligible keeps interval timing for non-money-based source mints", () => {
  const now = Date.parse("2026-07-02T00:01:00.000Z");
  assert.equal(
    isCronEligible(record({ sourceMint: "TOKEN", intervalMinutes: 5 }), now, new Set(["SOL"])),
    false
  );
});
