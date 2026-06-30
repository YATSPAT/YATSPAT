import type { NextApiRequest, NextApiResponse } from "next";

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
  error?: string;
}

const JUPITER_API = "https://quote-api.jup.ag/v6";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuoteResponse | { error: string }>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const inputMint = (req.query.inputMint as string)?.trim();
  const outputMint = (req.query.outputMint as string)?.trim();
  const amount = (req.query.amount as string)?.trim();
  const slippageBps = Number(req.query.slippageBps || 50);

  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({ error: "inputMint, outputMint, and amount required" });
  }

  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
    });

    const jupRes = await fetch(`${JUPITER_API}/quote?${params}`);
    const data = await jupRes.json();

    if (!jupRes.ok || data.error) {
      return res.status(200).json({
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: "0",
        priceImpactPct: "0",
        routePlan: [],
        error: data.error || "No route found",
      });
    }

    return res.status(200).json({
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inAmount: data.inAmount,
      outAmount: data.outAmount,
      priceImpactPct: data.priceImpactPct,
      routePlan: data.routePlan || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
