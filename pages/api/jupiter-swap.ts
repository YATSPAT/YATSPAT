import type { NextApiRequest, NextApiResponse } from "next";

interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  error?: string;
}

const JUPITER_API = "https://quote-api.jup.ag/v6";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SwapResponse | { error: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const inputMint = ((req.body as Record<string, unknown>)?.inputMint as string)?.trim();
  const outputMint = ((req.body as Record<string, unknown>)?.outputMint as string)?.trim();
  const amount = ((req.body as Record<string, unknown>)?.amount as string)?.trim();
  const userPublicKey = ((req.body as Record<string, unknown>)?.userPublicKey as string)?.trim();
  const slippageBps = Number((req.body as Record<string, unknown>)?.slippageBps || 100);

  if (!inputMint || !outputMint || !amount || !userPublicKey) {
    return res.status(400).json({ error: "inputMint, outputMint, amount, and userPublicKey required" });
  }

  try {
    // 1. Get quote
    const quoteParams = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
    const quoteRes = await fetch(`${JUPITER_API}/quote?${quoteParams}`);
    const quoteData = await quoteRes.json();

    if (!quoteRes.ok || quoteData.error) {
      return res.status(200).json({
        swapTransaction: "",
        lastValidBlockHeight: 0,
        inputMint, outputMint, inAmount: amount, outAmount: "0",
        priceImpactPct: "0", error: quoteData.error || "No route found",
      });
    }

    // 2. Get swap transaction
    const swapBody = {
      quoteResponse: quoteData,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    };

    const swapRes = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swapBody),
    });
    const swapData = await swapRes.json();

    if (!swapRes.ok || swapData.error) {
      return res.status(200).json({
        swapTransaction: "",
        lastValidBlockHeight: 0,
        inputMint, outputMint, inAmount: amount, outAmount: quoteData.outAmount || "0",
        priceImpactPct: quoteData.priceImpactPct || "0",
        error: swapData.error || "Swap transaction build failed",
      });
    }

    return res.status(200).json({
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight || 0,
      inputMint,
      outputMint,
      inAmount: amount,
      outAmount: quoteData.outAmount,
      priceImpactPct: quoteData.priceImpactPct,
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Swap failed" });
  }
}
