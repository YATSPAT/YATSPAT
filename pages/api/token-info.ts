import type { NextApiRequest, NextApiResponse } from "next";
import { fetchTokenInfoBatch } from "../../lib/tokenMeta";

/* ── GET /api/token-info?mints=a,b,c ─────────────────────────────────
   Live on-chain data (name, symbol, image, supply, price, market cap)
   for the tokens referenced in the pipeline form, shown in the HUD.
   Degrades to an empty map when Helius is unavailable. */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET only" });

  const raw = String(req.query.mints || "").trim();
  const mints = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) : [];
  if (!mints.length) return res.status(200).json({ ok: true, tokens: {} });

  try {
    const map = await fetchTokenInfoBatch(mints);
    const tokens: Record<string, unknown> = {};
    for (const [k, v] of map) tokens[k] = v;
    return res.status(200).json({ ok: true, tokens });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
