import type { NextApiRequest, NextApiResponse } from "next";

/* ── POST /api/deploy ────────────────────────────────────────────────
   Saves pipeline config to in-memory cache. No downloads, no files.
   The cron poller reads this via GET /api/auto-config and runs locally. */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { sourceMint, sourceWallet, network, rules, cron } = req.body;
  if (!sourceMint) return res.status(400).json({ error: "sourceMint required" });
  if (!rules?.length) return res.status(400).json({ error: "rules required" });

  const config = {
    sourceMint,
    sourceWallet: sourceWallet || "",
    network: network || "mainnet",
    rules,
    cron: cron || "every 5m",
  };

  // Forward to auto-config (same memory space in serverless)
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    await fetch(`${baseUrl}/api/auto-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  } catch {
    // Best-effort; config may not persist across cold starts
  }

  return res.json({
    ok: true,
    message: "Pipeline deployed. The cron poller will pick up this config on the next tick.",
  });
}
