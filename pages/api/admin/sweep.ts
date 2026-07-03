import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getSupabase } from "../../../lib/supabase";
import { getConnection } from "../../../lib/rpc";
import { loadPipelineWallet } from "../../../lib/walletGen";

/* ── POST /api/admin/sweep ───────────────────────────────────────────
   Admin-only. Drains native SOL from every pipeline operations wallet we
   can still decrypt into a destination wallet. Wallets whose keys were
   encrypted with a since-rotated KEYPAIR_ENCRYPTION_KEY can't be decrypted
   and are reported as skipped, never touched.

   Auth: Authorization: Bearer <SWEEP_SECRET>.
   Body: { destination: string, dryRun?: boolean }.
   dryRun reports balances + which wallets are recoverable, moves nothing. */

const TX_FEE_LAMPORTS = 5000; // base fee for a 1-signature transfer

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = process.env.SWEEP_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const destination = String(req.body?.destination || "").trim();
  const dryRun = req.body?.dryRun === true;
  let destPk: PublicKey;
  try {
    destPk = new PublicKey(destination);
  } catch {
    return res.status(400).json({ error: "invalid destination address" });
  }

  try {
    const { data, error } = await getSupabase()
      .from("pipelines")
      .select("id, source_wallet, encrypted_keypair");
    if (error) throw new Error(error.message);

    const conn = getConnection();
    const results: any[] = [];
    let totalSweptLamports = 0;

    for (const row of data || []) {
      const id = String(row.id).slice(0, 8);
      let kp;
      try {
        kp = loadPipelineWallet(row.encrypted_keypair);
      } catch {
        results.push({ id, wallet: row.source_wallet, skipped: "cannot decrypt (rotated key)" });
        continue;
      }

      const wallet = kp.publicKey.toBase58();
      try {
        const bal = await conn.getBalance(kp.publicKey, "confirmed");
        if (bal <= TX_FEE_LAMPORTS) {
          results.push({ id, wallet, balanceSol: bal / 1e9, skipped: "balance below tx fee" });
          continue;
        }
        const amount = bal - TX_FEE_LAMPORTS;

        if (dryRun) {
          results.push({ id, wallet, balanceSol: bal / 1e9, wouldSweepSol: amount / 1e9 });
          totalSweptLamports += amount;
          continue;
        }

        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
        const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight }).add(
          SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: destPk, lamports: amount })
        );
        tx.sign(kp);
        const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 5 });
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

        results.push({ id, wallet, sweptSol: amount / 1e9, txid: sig });
        totalSweptLamports += amount;
      } catch (e: any) {
        results.push({ id, wallet, error: e?.message ?? String(e) });
      }
    }

    return res.json({
      ok: true,
      dryRun,
      destination,
      totalSol: totalSweptLamports / 1e9,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
