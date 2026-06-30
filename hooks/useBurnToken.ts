import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createBurnInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

export function useBurnToken() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [burning, setBurning] = useState(false);
  const [burnError, setBurnError] = useState("");

  const executeBurn = useCallback(
    async (mint: string, amount: number, decimals: number): Promise<string | null> => {
      if (!publicKey || !signTransaction) {
        setBurnError("Wallet not connected");
        return null;
      }

      setBurning(true);
      setBurnError("");

      try {
        const mintPubkey = new PublicKey(mint);

        // Find the user's token account for this mint
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false);

        // Build burn instruction
        const burnIx = createBurnInstruction(
          ata,
          mintPubkey,
          publicKey,
          BigInt(Math.floor(amount * 10 ** decimals))
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction().add(burnIx);
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signedTx = await signTransaction(tx);
        const txid = await sendTransaction(signedTx, connection, { skipPreflight: true });

        await connection.confirmTransaction(
          { signature: txid, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        return txid;
      } catch (e) {
        setBurnError(e instanceof Error ? e.message : "Burn failed");
        return null;
      } finally {
        setBurning(false);
      }
    },
    [publicKey, signTransaction, sendTransaction, connection]
  );

  return { executeBurn, burning, burnError, clearError: () => setBurnError("") };
}
