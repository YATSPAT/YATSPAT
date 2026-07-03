import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { getPipeline, setPipelineEnabled } from "../../lib/pipelineStore";
import { getConnection } from "../../lib/rpc";
import { checkEntitlement } from "../../lib/feeSharing";

/* ── POST /api/activate ──────────────────────────────────────────────
   Verifies on-chain that the pipeline's generated wallet is actually the
   configured fee receiver for its token (a shareholder with non-zero bps),
   and only then enables the pipeline. This is the gate that stops a
   misconfigured pipeline from going live and silently collecting nothing. */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ error: "id required" });

  try {
    const pipeline = await getPipeline(id);
    if (!pipeline) return res.status(404).json({ error: "pipeline not found" });
    if (!pipeline.feeMint) return res.status(400).json({ error: "pipeline has no fee_mint" });

    const connection = getConnection();
    const check = await checkEntitlement(
      connection,
      new PublicKey(pipeline.feeMint),
      pipeline.sourceWallet // the generated operations wallet
    );

    if (!check.isShareholder) {
      return res.json({
        ok: true,
        activated: false,
        entitlement: check,
      });
    }

    await setPipelineEnabled(id, true);
    return res.json({
      ok: true,
      activated: true,
      entitlement: check,
      message: `Activated — ${check.reason}`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
