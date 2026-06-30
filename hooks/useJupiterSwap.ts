import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

const JUPITER_API = "https://quote-api.jup.ag/v6";

interface QuoteResult {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  error?: string;
}

export function useJupiterSwap() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState("");

  /** Get a price quote — calls Jupiter directly from browser */
  const quote = useCallback(
    async (inputMint: string, outputMint: string, amount: string): Promise<QuoteResult | null> => {
      try {
        const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: "100" });
        const res = await fetch(`${JUPITER_API}/quote?${params}`);
        const data = await res.json();
        if (data.error) {
          setSwapError(data.error);
          return null;
        }
        return data as QuoteResult;
      } catch (e) {
        setSwapError(e instanceof Error ? e.message : "Quote failed");
        return null;
      }
    },
    []
  );

  /** Execute a swap — quote then swap, sign, send */
  const executeSwap = useCallback(
    async (inputMint: string, outputMint: string, amount: string) => {
      if (!publicKey || !signTransaction) {
        setSwapError("Wallet not connected");
        return null;
      }

      setSwapping(true);
      setSwapError("");

      try {
        // 1. Quote
        const qParams = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: "100" });
        const qRes = await fetch(`${JUPITER_API}/quote?${qParams}`);
        const quoteData = await qRes.json();
        if (quoteData.error) throw new Error(quoteData.error);

        // 2. Build swap tx
        const sRes = await fetch(`${JUPITER_API}/swap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: publicKey.toBase58(),
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: "auto",
          }),
        });
        const swapData = await sRes.json();
        if (swapData.error) throw new Error(swapData.error);

        // 3. Deserialize, sign, send
        const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, "base64"));
        const signed = await signTransaction(tx);
        const txid = await sendTransaction(signed, connection, { skipPreflight: false, maxRetries: 3 });

        // 4. Confirm
        const bh = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          { signature: txid, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
          "confirmed"
        );

        return { txid, outAmount: quoteData.outAmount };
      } catch (e) {
        setSwapError(e instanceof Error ? e.message : "Swap failed");
        return null;
      } finally {
        setSwapping(false);
      }
    },
    [publicKey, signTransaction, sendTransaction, connection]
  );

  return { quote, executeSwap, swapping, swapError, clearError: () => setSwapError("") };
}
