import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";

const PUMPPORTAL_TRADE_LOCAL = "https://pumpportal.fun/api/trade-local";

export interface ClaimResult {
  claimed: boolean;
  txid?: string;
  claimedLamports?: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Priority fee bid (SOL) sent to PumpPortal when building the claim tx. Low bids get skipped
// under any congestion, so the tx is signed but never included — that's the "sent but never
// lands" failure mode, not a slow-confirm false negative.
const CLAIM_PRIORITY_FEE_SOL = 0.0007;

// Re-broadcast the same signed tx on this cadence instead of waiting passively — a dropped
// tx just needs to be resubmitted to the same leader schedule, not replaced.
const REBROADCAST_INTERVAL_MS = 2_000;

// One signed tx, tracked until ITS OWN blockhash expires (not a fixed wall-clock timeout).
// Returns "landed" | "expired" | an on-chain error string.
async function trackSignedTx(
  connection: Connection,
  rawTx: Uint8Array,
  txid: string,
  blockhash: string
): Promise<"landed" | "expired" | string> {
  while (true) {
    const [statusRes, validRes] = await Promise.all([
      connection.getSignatureStatuses([txid], { searchTransactionHistory: false }),
      connection.isBlockhashValid(blockhash, { commitment: "confirmed" }),
    ]);

    const status = statusRes.value[0];
    if (status?.err) return `Transaction failed: ${JSON.stringify(status.err)}`;
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return "landed";

    if (!validRes.value) {
      // Blockhash is dead. One last check with searchTransactionHistory in case it landed right
      // at the boundary and hasn't shown up in the fast (non-history) status lookup yet.
      const finalStatus = (
        await connection.getSignatureStatuses([txid], { searchTransactionHistory: true })
      ).value[0];
      if (finalStatus?.err) return `Transaction failed: ${JSON.stringify(finalStatus.err)}`;
      if (finalStatus?.confirmationStatus === "confirmed" || finalStatus?.confirmationStatus === "finalized") return "landed";
      return "expired";
    }

    // Re-broadcast the identical signed tx — never build a new one while this blockhash is alive,
    // that would be a second claim signature racing the first (potential double-claim).
    await connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    await sleep(REBROADCAST_INTERVAL_MS);
  }
}

/* ── Claim Pump.fun creator fees (paid in SOL) via PumpPortal's Local Transaction API ──
   Self-custodial: PumpPortal returns an unsigned VersionedTransaction, we sign it with the
   pipeline's own keypair and submit it ourselves. The local endpoint claims all accrued
   creator fees for the wallet (no per-mint param). Failures — including "nothing to claim" —
   are returned, never thrown, so a claim hiccup never aborts the rest of the pipeline run. */
export async function claimCreatorFees(connection: Connection, keypair: Keypair): Promise<ClaimResult> {
  try {
    const beforeLamports = await connection.getBalance(keypair.publicKey, "confirmed");
    let txid = "";
    let lastError = "";

    // Up to 3 DISTINCT claim attempts, each with its own fresh tx + blockhash. A fresh attempt is
    // only fetched after the previous one's blockhash has fully expired — never two live at once.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(PUMPPORTAL_TRADE_LOCAL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: keypair.publicKey.toBase58(),
          action: "collectCreatorFee",
          priorityFee: CLAIM_PRIORITY_FEE_SOL,
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        return { claimed: false, error: `PumpPortal ${res.status}: ${msg.slice(0, 200)}` };
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0) return { claimed: false, error: "empty response from PumpPortal" };

      const tx = VersionedTransaction.deserialize(new Uint8Array(buf));
      tx.sign([keypair]);
      const rawTx = tx.serialize();
      const blockhash = tx.message.recentBlockhash;

      txid = await connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 5 });
      const outcome = await trackSignedTx(connection, rawTx, txid, blockhash);

      if (outcome === "landed") {
        lastError = "";
        break;
      }
      lastError = outcome === "expired"
        ? `Signature ${txid} was not confirmed before its blockhash expired`
        : outcome;
    }

    if (lastError) return { claimed: false, error: lastError };

    const afterLamports = await connection.getBalance(keypair.publicKey, "confirmed");
    return { claimed: true, txid, claimedLamports: Math.max(0, afterLamports - beforeLamports) };
  } catch (err: any) {
    return { claimed: false, error: err?.message ?? String(err) };
  }
}
