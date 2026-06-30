import type { NextApiRequest, NextApiResponse } from "next";

// In-memory cache — survives between requests in same deployment
// (Vercel serverless can't write to disk, so we keep it warm in the handler)
// For actual persistence, the poller reads from ~/.hermes/scripts/reflector-jobs.json

let cached: Record<string, unknown> = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: boolean } & Record<string, unknown>>
) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, ...cached });
  }

  if (req.method === "POST") {
    cached = req.body as Record<string, unknown>;
    return res.status(200).json({ ok: true, ...cached });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
