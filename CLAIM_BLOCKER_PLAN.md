# Blocker: creator-fee claim never lands ("not confirmed before retry timeout")

_Diagnosed 2026-07-01. Both live pipelines fail at the **claim** step; nothing downstream (swap/burn/distribute) ever runs._

## Symptom
`last_run_status = error`, summary:
`creator fee claim failed: Signature <sig> was not confirmed before retry timeout`

## What was verified on-chain
- The failing claim signatures (`5J525…` for FFyo, `5VB2ae…` for B2jz) return **null** from `getTransaction` and are **absent from each wallet's signature history** → the signed tx is **sent but never lands on-chain** (not a slow-confirm false negative; it genuinely isn't included).
- **FFyo `FFyoHmquQBXTurwLEbC5jXaYELHnK2sCzQogTUaHkaNU` = 0 SOL.** Empty wallet → cannot pay the ~0.000005 SOL fee, so its claim tx can never be included.
- **B2jz `B2jzSSTiUXQGgG5cXsMdAJcKEQrBhhVLMmjyALA8mkz` = 0.198 SOL.** Funded, yet still fails.
- Read-only probe of PumpPortal (`POST /api/trade-local action=collectCreatorFee`) for B2jz returns **HTTP 200, 634 bytes, a VALID VersionedTransaction** (`isBlockhashValid: true`, 7 instructions, references pump program `6EF8…F6P` + PumpSwap `pAMM…52FMfXEA`). So the tx PumpPortal hands back is landable — the problem is on **our send/confirm path**, not PumpPortal.

## Root causes (two, independent)
1. **FFyo is out of SOL.** A creator-fee claim is itself a transaction and needs a SOL float to pay fees. FFyo was drained to 0 (earlier stranded-token churn + fees, before the reward-only funding guard existed). It is dead until funded. This is a **bootstrap requirement**: a pipeline wallet must always hold a small SOL float.
2. **The claim send/confirm path is unreliable and drops valid txs** (this is what hits the *funded* wallet B2jz). In `lib/pumpClaim.ts`:
   - **Low priority fee** (`priorityFee: 0.00005`) + `skipPreflight: true` + **no re-broadcast** → under any congestion the tx sits and is dropped before inclusion.
   - **Confirmation window is wrong.** `waitForSignature` polls `getSignatureStatuses(..., {searchTransactionHistory:false})` for a fixed **30 s**, but a Solana blockhash is valid for ~60–90 s. We give up before the tx's own deadline, and (worse) the retry loop **re-fetches a brand-new tx from PumpPortal each attempt** (new blockhash → new signature). So attempt 1 can still land *after* we've abandoned it while attempt 2 sends a second claim — a lost-update / potential double-claim race, and the run is reported failed either way.

## Plan for the next agent

### A. Immediate (operator / user action — cannot be done from code)
1. **Fund FFyo** with ~0.05 SOL, or retire that pipeline (`enabled=false`). It cannot run at 0 SOL.
2. Confirm the wallets actually have **pending** creator fees right now (if a wallet has nothing to claim, the claim tx lands *with an error* — that's a different failure than the "never lands" seen here, but worth ruling out).
3. Add a **minimum-float requirement** to the product: the wizard should tell users to keep ~0.05 SOL in the pipeline wallet, and `runPipeline` should short-circuit with a clear summary (`"wallet below minimum SOL float to operate"`) when `walletLamports < FLOOR` instead of attempting a claim that can't pay its fee.

### B. Code fix — make the claim actually land (`lib/pumpClaim.ts`)
Rewrite `claimCreatorFees` so it:
1. **Requests a higher priority fee** from PumpPortal (e.g. `priorityFee: 0.0005`–`0.001`) so the built tx has a competitive compute-unit price.
2. **Fetches + signs the tx ONCE**, then **re-broadcasts that same signed tx** (`sendRawTransaction`, `skipPreflight:true`) every ~2 s in a loop.
3. **Confirms against the tx's own blockhash deadline**: derive `lastValidBlockHeight` (from `getLatestBlockhash` captured at send time, or poll `getBlockHeight`) and use `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed")`. This waits exactly as long as the tx *can* land and returns a definitive dead/alive answer — no arbitrary 30 s cutoff.
4. Only **after the blockhash truly expires** (still unconfirmed) fetch a *fresh* tx and repeat — never run two different claim signatures concurrently.
5. Final status check should use `searchTransactionHistory: true`.
6. Keep the `beforeLamports`/`afterLamports` delta for `claimedLamports` (already correct).

### C. Test procedure (do NOT test on a wallet you don't control)
1. Use a throwaway wallet that **has real accrued Pump.fun creator fees** and ~0.05 SOL float.
2. Create a pipeline for it, then `vercel crons run /api/cron/run-pipelines` (needs `CRON_SECRET`; or hit the endpoint with the bearer).
3. Read `last_run_results` and verify the `claim` entry has a `txid` **that is non-null via `getTransaction`** (i.e. actually on-chain) and `claimedLamports > 0`.
4. Only once the claim reliably lands should downstream swap/burn/distribute be re-verified.

### D. Related open issues (already documented, still true)
- Distribute is **rent-underfunded**: each new recipient ATA costs ~0.002 SOL, ~0.2 SOL for 100 holders, but the fee reserve is a flat 0.02 SOL → distribute fails mid-batch and strands tokens. Size the reserve to `recipients × ~0.0021 SOL`.
- **Stranded tokens are never swept** — any partial failure leaves bought tokens un-processed forever (FFyo already accumulated ~314 `9cRCn` this way). Add a sweep, or process full wallet token balance for the mint.
- A single failing transfer aborts a whole 5-transfer batch (no per-holder isolation).
- A run that hits Vercel's function time limit mid-distribute leaves `summary="running"` and unrecorded partial state.

## Files
- `lib/pumpClaim.ts` — the claim send/confirm logic (primary fix, §B).
- `lib/pipelineExecutor.ts` — `runPipeline` (add the minimum-float short-circuit, §A3).
- `lib/rewardFunding.ts` — `spendableClaimedRewardLamports` (correct as-is; reserve sizing for distribute rent, §D).
