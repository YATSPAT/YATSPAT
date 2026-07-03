import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { cronPresetToIntervalMinutes } from "../../lib/schedule";
import { createPipeline } from "../../lib/pipelineStore";
import type { SplitRule } from "../../lib/pipelineStore";
import { generatePipelineWallet } from "../../lib/walletGen";

/* ── POST /api/deploy ────────────────────────────────────────────────
   Fee-sharing model: the panel GENERATES a fresh operations wallet, stores
   the pipeline DISABLED, and returns the wallet's public key. The creator
   then sets that wallet as their token's sole fee receiver on Pump.fun and
   calls /api/activate, which verifies entitlement on-chain before enabling.
   No creator private key ever touches the app. */

// Canonical wrapped-SOL mint — creator-fee collection settles as SOL.
const WSOL_MINT = "So11111111111111111111111111111111111111112";

function isValidPubkey(s: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { feeMint, rules, cron, ownerAddress, dropThresholdSol } = req.body;

  const mint = (feeMint || "").trim();
  if (!mint) return res.status(400).json({ error: "feeMint required — the token whose creator fees this pipeline collects" });
  if (!isValidPubkey(mint)) return res.status(400).json({ error: "feeMint is not a valid Solana address" });
  if (!Array.isArray(rules) || !rules.length) return res.status(400).json({ error: "rules required" });

  const cleanRules = (rules as SplitRule[])
    .filter((r) => r.pct > 0)
    .map((r) => ({
      type: r.type,
      pct: r.pct,
      targetMint: (r.targetMint || "").trim(),
      targetWallet: (r.targetWallet || "").trim(),
      holderMint: (r.holderMint || "").trim(),
    }));
  if (!cleanRules.length) return res.status(400).json({ error: "at least one rule with pct > 0 is required" });
  const totalPct = cleanRules.reduce((s, r) => s + r.pct, 0);
  if (totalPct !== 100) return res.status(400).json({ error: `rules must total 100% (got ${totalPct}%)` });

  // Spendable SOL required before a distribution round fires. Omit/blank to use the platform default.
  let dropThresholdLamports: number | null = null;
  if (dropThresholdSol !== undefined && dropThresholdSol !== null && dropThresholdSol !== "") {
    const parsed = Number(dropThresholdSol);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: "dropThresholdSol must be a non-negative number" });
    }
    dropThresholdLamports = Math.round(parsed * 1e9);
  }

  const intervalMinutes = cronPresetToIntervalMinutes(cron);

  try {
    const wallet = generatePipelineWallet();
    const pipeline = await createPipeline({
      ownerAddress: ownerAddress || null,
      sourceMint: WSOL_MINT,
      sourceWallet: wallet.publicKey, // the generated operations wallet
      rules: cleanRules,
      intervalMinutes,
      claimCreatorFees: true,
      feeMint: mint,
      dropThresholdLamports,
      encryptedKeypair: wallet.encryptedKeypair,
      enabled: false, // stays off until entitlement is verified via /api/activate
    });

    return res.json({
      ok: true,
      id: pipeline.id,
      walletPublicKey: wallet.publicKey,
      feeMint: mint,
      intervalMinutes,
      message:
        `Pipeline created (paused). Set this wallet as your token's fee receiver on Pump.fun, ` +
        `then activate: ${wallet.publicKey}`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
