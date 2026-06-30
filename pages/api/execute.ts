import type { NextApiRequest, NextApiResponse } from "next";
import { Connection, PublicKey, Keypair, Transaction, ComputeBudgetProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createBurnInstruction, createTransferInstruction, getAccount } from "@solana/spl-token";
import bs58 from "bs58";

const HELIUS_KEY = process.env.HELIUS_API_KEY || "";
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";

const connection = new Connection(RPC_URL, "confirmed");
const JUPITER_API = "https://quote-api.jup.ag/v6";

/* ── load keypair from env or fallback to plan-only ────────────────── */
function loadKeypair(): Keypair | null {
  const raw = process.env.SOLANA_CREATOR_KEYPAIR;
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
    try {
      return Keypair.fromSecretKey(bs58.decode(raw));
    } catch {
      // try as full keypair JSON
      const parsed = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
  } catch {
    return null;
  }
}

/* ── Jupiter swap ───────────────────────────────────────────────────── */
async function jupiterSwap(keypair: Keypair, inputMint: string, outputMint: string, amount: number) {
  // 1. Quote
  const quoteUrl = `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`;
  const quoteRes = await fetch(quoteUrl);
  const quoteData = await quoteRes.json();
  if (!quoteData.outAmount) throw new Error(`No route: ${inputMint.slice(0,8)} → ${outputMint.slice(0,8)}`);

  // 2. Swap TX
  const swapRes = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxPriorityLamports: 1_000_000, priorityLevel: "high" } },
    }),
  });
  const swapData = await swapRes.json();
  if (!swapData.swapTransaction) throw new Error("No swap transaction returned");

  // 3. Sign & send
  const tx = Transaction.from(Buffer.from(swapData.swapTransaction, "base64"));
  const sig = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: "confirmed", skipPreflight: true });
  return { txid: sig, outAmount: Number(quoteData.outAmount) };
}

/* ── Burn tokens ────────────────────────────────────────────────────── */
async function burnTokens(keypair: Keypair, mint: string, amount: number) {
  const mintPubkey = new PublicKey(mint);
  const ata = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createBurnInstruction(ata, mintPubkey, keypair.publicKey, amount)),
    [keypair],
    { commitment: "confirmed" }
  );
  return { txid: sig, burned: amount };
}

/* ── Distribute to holders ──────────────────────────────────────────── */
async function distributeTokens(keypair: Keypair, mint: string, holders: { address: string; pct: number }[], totalTokens: number) {
  const mintPubkey = new PublicKey(mint);
  const sourceAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
  const results: { address: string; amount: number; txid: string }[] = [];

  // Get decimal info
  const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
  const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 6;
  const rawAmount = Math.floor(totalTokens * 10 ** decimals);

  // Batch transfers in groups of 8 (tx size limit)
  const BATCH_SIZE = 8;
  for (let i = 0; i < holders.length; i += BATCH_SIZE) {
    const batch = holders.slice(i, i + BATCH_SIZE);
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    );

    for (const h of batch) {
      const amount = Math.floor(rawAmount * (h.pct / 100));
      if (amount <= 0) continue;
      const dest = new PublicKey(h.address);
      const destAta = await getAssociatedTokenAddress(mintPubkey, dest);
      tx.add(createTransferInstruction(sourceAta, destAta, keypair.publicKey, amount));
    }

    if (tx.instructions.length > 1) {
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: "confirmed", skipPreflight: true });
      for (const h of batch) {
        results.push({ address: h.address, amount: Math.floor(totalTokens * (h.pct / 100)), txid: sig });
      }
    }
  }

  return results;
}

/* ── Snapshot holders via Helius ────────────────────────────────────── */
async function getTokenHolders(mint: string): Promise<{ address: string; balance: number; pct: number }[]> {
  if (!HELIUS_KEY) throw new Error("HELIUS_API_KEY required for holder snapshots");

  let allHolders: any[] = [];
  let cursor: string | null = null;
  const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

  do {
    const heliusRes: any = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccounts",
        params: { mint, limit: 1000, cursor, displayOptions: { showZeroBalance: false } },
      }),
    });
    const data: any = await heliusRes.json();
    if (data.error) throw new Error(`Helius error: ${data.error.message}`);
    const items: any[] = data.result?.token_accounts || [];
    allHolders.push(...items);
    cursor = data.result?.cursor;
  } while (cursor);

  const total = allHolders.reduce((sum, h) => sum + (h.amount || 0), 0);
  return allHolders
    .filter(h => h.amount > 0 && h.owner !== "11111111111111111111111111111111")
    .map(h => ({
      address: h.owner,
      pct: total > 0 ? ((h.amount || 0) / total) * 100 : 0,
      balance: h.amount || 0,
    }))
    .sort((a, b) => b.balance - a.balance);
}

/* ── Main handler ───────────────────────────────────────────────────── */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { sourceMint, sourceWallet, rules } = req.body;
  if (!sourceMint) return res.status(400).json({ error: "sourceMint required" });
  if (!rules?.length) return res.status(400).json({ error: "rules required" });

  const keypair = loadKeypair();
  if (!keypair) return res.status(400).json({ error: "SOLANA_CREATOR_KEYPAIR not set — add via vercel env add SOLANA_CREATOR_KEYPAIR production" });

  const results: any[] = [];

  try {
    // Check source wallet balance
    const walletPubkey = sourceWallet ? new PublicKey(sourceWallet) : keypair.publicKey;
    const sourceMintPubkey = new PublicKey(sourceMint);
    const sourceAta = await getAssociatedTokenAddress(sourceMintPubkey, walletPubkey);
    let sourceBalance = 0;

    try {
      const accountInfo = await getAccount(connection, sourceAta);
      sourceBalance = Number(accountInfo.amount);
    } catch {
      return res.json({ ok: true, plan: true, message: "No reward tokens to process", balance: 0, rules: [] });
    }

    if (sourceBalance <= 0) {
      return res.json({ ok: true, plan: true, message: "No reward tokens to process", balance: 0, rules: [] });
    }

    // Get decimals
    let decimals = 9;
    try {
      const mintInfo = await connection.getParsedAccountInfo(sourceMintPubkey);
      decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;
    } catch {}

    const balanceUi = sourceBalance / 10 ** decimals;

    // Process each rule
    for (const rule of rules) {
      const ruleAmount = Math.floor(sourceBalance * (rule.pct / 100));
      if (ruleAmount <= 0) continue;

      switch (rule.type) {
        case "burn": {
          const { txid } = await burnTokens(keypair, sourceMint, ruleAmount);
          results.push({ type: "burn", pct: rule.pct, amount: ruleAmount / 10 ** decimals, txid });
          break;
        }

        case "buy-burn": {
          if (!rule.targetMint) throw new Error("buy-burn requires targetMint");
          const swapResult = await jupiterSwap(keypair, sourceMint, rule.targetMint, ruleAmount);
          const burnResult = await burnTokens(keypair, rule.targetMint, swapResult.outAmount);
          results.push({ type: "buy-burn", pct: rule.pct, swapped: ruleAmount / 10 ** decimals, burned: swapResult.outAmount / 10 ** decimals, swapTxid: swapResult.txid, burnTxid: burnResult.txid });
          break;
        }

        case "distribute": {
          if (!rule.targetMint) throw new Error("distribute requires targetMint");
          if (!rule.holderMint) throw new Error("distribute requires holderMint");

          // Swap source → target token
          const swapResult = await jupiterSwap(keypair, sourceMint, rule.targetMint, ruleAmount);

          // Snapshot holders of holderMint
          const holders = await getTokenHolders(rule.holderMint);

          // Distribute
          const outTokens = swapResult.outAmount / 10 ** decimals;
          const distResults = await distributeTokens(keypair, rule.targetMint, holders, outTokens);

          results.push({
            type: "distribute",
            pct: rule.pct,
            swapped: ruleAmount / 10 ** decimals,
            outTokens,
            swapTxid: swapResult.txid,
            totalHolders: holders.length,
            distributions: distResults.slice(0, 20), // first 20 only for response brevity
          });
          break;
        }

        case "send": {
          if (!rule.targetMint) throw new Error("send requires targetMint");
          if (!rule.targetWallet) throw new Error("send requires targetWallet");

          const tx = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
            createTransferInstruction(sourceAta, await getAssociatedTokenAddress(new PublicKey(rule.targetMint), new PublicKey(rule.targetWallet)), keypair.publicKey, ruleAmount)
          );
          const sig = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: "confirmed" });
          results.push({ type: "send", pct: rule.pct, amount: ruleAmount / 10 ** decimals, destination: rule.targetWallet.slice(0, 8) + "…", txid: sig });
          break;
        }
      }
    }

    return res.json({ ok: true, executed: true, balance: balanceUi, results });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message, results });
  }
}
