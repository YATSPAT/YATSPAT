import { OnlinePumpSdk, PUMP_FEE_PROGRAM_ID } from "@pump-fun/pump-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const DISC = Buffer.from([216,74,9,0,56,140,93,75]).toString("base64");
// Try a few public endpoints; some allow getProgramAccounts, some don't.
const ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

async function getConfigs(url) {
  const conn = new Connection(url, "confirmed");
  // dataSlice: pull only the mint (offset 11, len 32) to keep payload tiny.
  const accts = await conn.getProgramAccounts(PUMP_FEE_PROGRAM_ID, {
    dataSlice: { offset: 11, length: 32 },
    filters: [{ memcmp: { offset: 0, bytes: DISC, encoding: "base64" } }],
  });
  return accts;
}

let configs = null, used = null;
for (const url of ENDPOINTS) {
  try {
    const c = await getConfigs(url);
    if (c && c.length) { configs = c; used = url; break; }
  } catch (e) { console.log("  endpoint failed:", url.replace(/https:\/\//,""), String(e).slice(0,70)); }
}
if (!configs) { console.log("could not enumerate configs on any public endpoint"); process.exit(0); }
console.log(`enumerated ${configs.length} SharingConfigs via ${used.replace(/https:\/\//,"")}`);

const conn = new Connection(used, "confirmed");
const sdk = new OnlinePumpSdk(conn);
const payer = new PublicKey("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j");

let checked = 0, distributable = 0;
for (const { account } of configs) {
  if (checked >= 40 || distributable >= 3) break;
  const mint = new PublicKey(account.data.subarray(0, 32));
  checked++;
  try {
    const min = await sdk.getMinimumDistributableFee(mint, payer);
    if (min.canDistribute) {
      distributable++;
      console.log(`\n✔ DISTRIBUTABLE: mint ${mint.toBase58()}`);
      console.log(`   accrued ${min.distributableFees.toString()} lamports, min ${min.minimumRequired.toString()}, graduated=${min.isGraduated}`);
      console.log(`   >>> use this mint for the simulate step`);
    }
  } catch { /* skip transient */ }
}
console.log(`\nchecked ${checked} configs, found ${distributable} with distributable fees now`);
