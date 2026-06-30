import type { NextApiRequest, NextApiResponse } from "next";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import os from "os";

/* ── POST /api/save-keypair ─────────────────────────────────────────
   Saves keypair to ~/.hermes/scripts/creator-keypair.json.
   Only works when running locally (not on Vercel serverless). */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { keypair } = req.body;
  if (!keypair?.trim()) return res.status(400).json({ error: "keypair required" });

  // Only allow local saves
  if (process.env.VERCEL || process.env.NOW_REGION) {
    return res.json({ ok: false, message: "Save locally: run 'npm run dev' and deploy from localhost." });
  }

  try {
    const dir = join(os.homedir(), ".hermes", "scripts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "creator-keypair.json"), keypair.trim());
    return res.json({ ok: true, saved: true, message: "Keypair saved to ~/.hermes/scripts/creator-keypair.json" });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
