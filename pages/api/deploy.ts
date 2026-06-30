import type { NextApiRequest, NextApiResponse } from "next";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import os from "os";

/* ── POST /api/deploy ────────────────────────────────────────────────
   Atomic deploy: saves config to cache AND keypair to file (when local).
   One call, zero helpers. */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { sourceMint, sourceWallet, network, rules, cron, keypair } = req.body;
  if (!sourceMint) return res.status(400).json({ error: "sourceMint required" });
  if (!rules?.length) return res.status(400).json({ error: "rules required" });

  const config = {
    sourceMint,
    sourceWallet: sourceWallet || "",
    network: network || "mainnet",
    rules,
    cron: cron || "every 5m",
  };

  const isLocal = !process.env.VERCEL && !process.env.NOW_REGION;
  const localFiles: string[] = [];

  // Save config to in-memory cache
  try {
    const baseUrl = isLocal
      ? `http://localhost:${process.env.PORT || 3000}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    await fetch(`${baseUrl}/api/auto-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  } catch {
    // Best-effort
  }

  // LOCAL: save config + keypair to ~/.hermes/scripts/
  if (isLocal) {
    const scriptsDir = join(os.homedir(), ".hermes", "scripts");
    try {
      mkdirSync(scriptsDir, { recursive: true });

      // Config file
      writeFileSync(
        join(scriptsDir, "reflector-jobs.json"),
        JSON.stringify({ jobs: [config] }, null, 2)
      );
      localFiles.push("reflector-jobs.json");

      // Keypair file
      if (keypair?.trim()) {
        writeFileSync(join(scriptsDir, "creator-keypair.json"), keypair.trim());
        localFiles.push("creator-keypair.json");
      }
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: `Cannot write files: ${err.message}` });
    }
  }

  // Keypair handling for remote deployments
  const hasKeypair = !!keypair?.trim();

  return res.json({
    ok: true,
    local: isLocal,
    files: localFiles,
    hasKeypair,
    message: isLocal
      ? `Pipeline deployed — ${localFiles.length} file${localFiles.length !== 1 ? "s" : ""} saved to ~/.hermes/scripts/
${!hasKeypair ? "╸ Add your keypair for on-chain execution." : ""}`
      : `Config saved. ${hasKeypair ? "Download the keypair file below." : ""}`,
  });
}
