#!/usr/bin/env node
/**
 * Reflector Execution Pipeline
 *
 * Reads config from ~/.hermes/scripts/reflector-jobs.json
 * Reads keypair from ~/.hermes/scripts/creator-keypair.json or SOLANA_CREATOR_KEYPAIR env
 * For each rule: swap → burn/distribute/send → confirm → print txid
 *
 * Usage: node scripts/execute-pipeline.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const bs58 = require("bs58");
const {
  Connection,
  Keypair,
  VersionedTransaction,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createBurnInstruction,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

// ═══════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════

const DRY_RUN = process.argv.includes("--dry-run");
const CONFIG_PATH = path.join(os.homedir(), ".hermes", "scripts", "reflector-jobs.json");
const KEYPAIR_PATH = path.join(os.homedir(), ".hermes", "scripts", "creator-keypair.json");
const JUPITER_API = "https://quote-api.jup.ag/v6";

const HELIUS_KEY = process.env.HELIUS_API_KEY || "";
const RPC_URL = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const connection = new Connection(RPC_URL, "confirmed");

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function log(msg, emoji = "⟡") {
  console.log(`${emoji}  ${msg}`);
}

function error(msg) {
  console.error(`❌  ${msg}`);
  process.exit(1);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    error(`No config found at ${CONFIG_PATH}. Generate one from the Reflector UI first.`);
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return cfg.jobs ? cfg.jobs[0] : cfg;
  } catch (e) {
    error(`Invalid config JSON: ${e.message}`);
  }
}

function loadKeypair() {
  const envKey = process.env.SOLANA_CREATOR_KEYPAIR;
  if (envKey) {
    try {
      const secret = Uint8Array.from(JSON.parse(envKey));
      return Keypair.fromSecretKey(secret);
    } catch {
      try {
        return Keypair.fromSecretKey(bs58.decode(envKey));
      } catch (e) {
        if (DRY_RUN) {
          log(`Invalid keypair env var but continuing in dry-run: ${e.message}`, "⚠️");
          return null;
        }
        error(`Invalid SOLANA_CREATOR_KEYPAIR: ${e.message}`);
      }
    }
  }

  if (!fs.existsSync(KEYPAIR_PATH)) {
    if (DRY_RUN) {
      log("No keypair found — dry-run mode will simulate without signing", "⚠️");
      return null;
    }
    error(
      `No keypair found.\n\n` +
      `  Option 1: Export SOLANA_CREATOR_KEYPAIR='[1,2,3,...]' (JSON array of secret key bytes)\n` +
      `  Option 2: Export SOLANA_CREATOR_KEYPAIR='<base58 string>'\n` +
      `  Option 3: Save keypair JSON to ${KEYPAIR_PATH}\n`
    );
  }

  try {
    const raw = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
    const secret = Uint8Array.from(raw);
    return Keypair.fromSecretKey(secret);
  } catch (e) {
    if (DRY_RUN) {
      log(`Invalid keypair file but continuing in dry-run: ${e.message}`, "⚠️");
      return null;
    }
    error(`Invalid keypair file: ${e.message}`);
  }
}

async function jupiterSwap(creator, inputMint, outputMint, amount) {
  log(`Quote: ${inputMint.slice(0, 6)}… → ${outputMint.slice(0, 6)}…  amount=${amount}`);

  if (DRY_RUN) {
    log(`  DRY RUN — would swap tokens via Jupiter`, "🔍");
    return { txid: "(dry-run)", outAmount: "0" };
  }

  const creatorPubkey = creator.publicKey.toBase58();

  // 1. Quote
  const qParams = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: "100" });
  const qRes = await fetch(`${JUPITER_API}/quote?${qParams}`);

  if (!qRes.ok) {
    const text = await qRes.text();
    throw new Error(`Jupiter quote failed: ${qRes.status} ${text.slice(0, 200)}`);
  }

  const quoteData = await qRes.json();

  if (quoteData.error) throw new Error(`Jupiter quote: ${quoteData.error}`);
  log(`  Route found — outAmount=${quoteData.outAmount}  impact=${quoteData.priceImpactPct}%`);

  // 2. Build swap tx
  const sRes = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: creatorPubkey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  const swapData = await sRes.json();
  if (swapData.error) throw new Error(`Jupiter swap build: ${swapData.error}`);

  // 3. Deserialize & sign
  const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, "base64"));
  tx.sign([creator]);

  // 4. Send & confirm
  const txid = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  log(`  Swap tx sent: ${txid.slice(0, 16)}…`, "📤");

  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature: txid, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
    "confirmed"
  );

  log(`  Swap confirmed: ${txid.slice(0, 16)}…`, "✅");
  return { txid, outAmount: quoteData.outAmount };
}

async function burnTokens(creator, mint, amount, decimals) {
  const mintPubkey = new PublicKey(mint);
  const ata = await getAssociatedTokenAddress(mintPubkey, creator.publicKey);

  const rawAmount = BigInt(Math.floor(amount * 10 ** decimals));
  log(`Burn: ${mint.slice(0, 8)}…  amount=${amount}  raw=${rawAmount}`);

  if (DRY_RUN) {
    log(`  DRY RUN — would burn ${amount} tokens`, "🔍");
    return "(dry-run)";
  }

  const burnIx = createBurnInstruction(ata, mintPubkey, creator.publicKey, rawAmount);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(burnIx);
  tx.recentBlockhash = blockhash;
  tx.feePayer = creator.publicKey;

  const signed = await tx.sign(creator);
  const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });

  await connection.confirmTransaction(
    { signature: txid, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  log(`  Burn confirmed: ${txid.slice(0, 16)}…`, "🔥");
  return txid;
}

async function transferTokens(creator, mint, toWallet, amount, decimals) {
  const mintPubkey = new PublicKey(mint);
  const fromAta = await getAssociatedTokenAddress(mintPubkey, creator.publicKey);
  const toPubkey = new PublicKey(toWallet);
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

  const rawAmount = BigInt(Math.floor(amount * 10 ** decimals));

  log(`Transfer: ${mint.slice(0, 8)}… → ${toWallet.slice(0, 8)}…  amount=${amount}`);

  if (DRY_RUN) {
    log(`  DRY RUN — would transfer ${amount} tokens`, "🔍");
    return "(dry-run)";
  }

  const ix = createTransferInstruction(fromAta, toAta, creator.publicKey, rawAmount);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = blockhash;
  tx.feePayer = creator.publicKey;

  const signed = await tx.sign(creator);
  const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });

  await connection.confirmTransaction(
    { signature: txid, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  log(`  Transfer confirmed: ${txid.slice(0, 16)}…`, "💸");
  return txid;
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  log("Reflector Execution Pipeline", "🚀");
  if (DRY_RUN) log("DRY RUN MODE — no transactions will be sent", "🔍");

  const job = loadConfig();
  const creator = loadKeypair();

  if (creator) {
    log(`Creator wallet: ${creator.publicKey.toBase58().slice(0, 8)}…`);
  } else {
    log(`Creator wallet: (none — dry run only)`);
  }
  log(`RPC: ${RPC_URL.slice(0, 40)}…`);

  const sourceMint = job.sourceMint || job.source_mint;
  const rules = job.rules || [];

  if (!sourceMint) error("Config missing sourceMint");
  if (!rules.length) error("Config has no rules");

  // Check source wallet balance
  let sourceBalance = 0;
  let sourceDecimals = 9;
  let sourceMintPubkey;
  try {
    sourceMintPubkey = new PublicKey(sourceMint);
    if (creator) {
      const ata = await getAssociatedTokenAddress(sourceMintPubkey, creator.publicKey);
      try {
        const acct = await getAccount(connection, ata, "confirmed");
        sourceBalance = Number(acct.amount);
        sourceDecimals = 6;
        sourceBalance = sourceBalance / 10 ** sourceDecimals;
      } catch {
        sourceBalance = 0;
      }
    }
  } catch {
    sourceBalance = 0;
  }

  log(`Source balance: ${sourceBalance.toLocaleString()} tokens`);
  if (sourceBalance <= 0) {
    log("No tokens to distribute. Exiting.");
    process.exit(0);
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const pool = sourceBalance * (rule.pct / 100);

    log(`Rule ${i + 1}: ${rule.type} @ ${rule.pct}% = ${pool.toLocaleString()} tokens`);

    if (rule.type === "burn") {
      // Direct burn of source token
      await burnTokens(creator, sourceMint, pool, sourceDecimals);

    } else if (rule.type === "buy-burn" || rule.type === "distribute") {
      // Swap source → target
      const rawAmount = String(Math.floor(pool * 10 ** sourceDecimals));
      const swapResult = await jupiterSwap(creator, sourceMint, rule.targetMint, rawAmount);

      if (rule.type === "buy-burn") {
        // Burn the received tokens
        // Jupiter outAmount is in smallest units of output mint
        const outUi = Number(swapResult.outAmount) / 10 ** 9; // approx
        await burnTokens(creator, rule.targetMint, outUi, 9);
      } else if (rule.type === "distribute" && rule.holderMint) {
        // Fetch holders from API
        const holderRes = await fetch(
          `https://reflector-panel.vercel.app/api/holders?mint=${rule.holderMint}&network=mainnet`
        );
        const holderData = await holderRes.json();
        const holders = holderData.holders || [];

        if (!holders.length) {
          log(`  No holders found for ${rule.holderMint.slice(0, 8)}…`, "⚠️");
          continue;
        }

        const outUi = Number(swapResult.outAmount) / 10 ** 9;
        log(`  Distributing ${outUi.toLocaleString()} to ${holders.length} holders`);

        for (const h of holders) {
          const share = outUi * (h.percentage / 100);
          if (share < 0.000001) continue; // skip dust
          try {
            await transferTokens(creator, rule.targetMint, h.address, share, 9);
          } catch (e) {
            log(`  Failed to send to ${h.address}: ${e.message}`, "⚠️");
          }
        }
      }

    } else if (rule.type === "send") {
      if (!rule.targetWallet) {
        log(`  No target wallet for send rule. Skipping.`, "⚠️");
        continue;
      }
      await transferTokens(creator, sourceMint, rule.targetWallet, pool, sourceDecimals);
    }
  }

  log("Pipeline complete!", "🎉");
}

main().catch((e) => {
  console.error(`❌  Pipeline failed: ${e.message}`);
  process.exit(1);
});
