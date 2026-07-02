export interface Holder {
  address: string;
  balance: number;
  percentage: number;
}

function getRpc(network: "devnet" | "mainnet"): string {
  const key = process.env.HELIUS_API_KEY || "";
  if (network === "mainnet") {
    return key
      ? `https://mainnet.helius-rpc.com/?api-key=${key}`
      : "https://api.mainnet-beta.solana.com";
  }
  return key
    ? `https://devnet.helius-rpc.com/?api-key=${key}`
    : "https://api.devnet.solana.com";
}

async function fetchJsonRpc(rpc: string, method: string, params: unknown[], retries = 2) {
  let lastErr: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.code === 429 && i < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw new Error(data.error.message);
      }
      return data.result;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function fetchHolders(
  mint: string,
  network: "devnet" | "mainnet" = "mainnet"
): Promise<Holder[]> {
  const rpc = getRpc(network);

  const largest = await fetchJsonRpc(rpc, "getTokenLargestAccounts", [
    mint,
    { commitment: "confirmed" },
  ]);
  if (!largest?.value?.length) return [];

  const accountAddresses = largest.value.map((a: { address: string }) => a.address);
  const accountInfos = await fetchJsonRpc(rpc, "getMultipleAccounts", [
    accountAddresses,
    { encoding: "jsonParsed" },
  ]);

  const holders: Holder[] = [];
  let totalSupply = 0;

  for (let i = 0; i < largest.value.length; i++) {
    const tokenAccount = largest.value[i];
    const parsed = accountInfos?.value?.[i];
    if (!parsed) continue;
    const owner = parsed.data?.parsed?.info?.owner;
    if (!owner) continue;

    const decimals = tokenAccount.decimals;
    const rawAmount = BigInt(tokenAccount.amount);
    const uiAmount = Number(rawAmount) / 10 ** decimals;
    if (uiAmount <= 0) continue;

    holders.push({
      address: owner.slice(0, 4) + "..." + owner.slice(-4),
      balance: Math.round(uiAmount * 100) / 100,
      percentage: 0,
    });
    totalSupply += uiAmount;
  }

  for (const h of holders) {
    h.percentage = totalSupply > 0 ? Math.round((h.balance / totalSupply) * 10000) / 100 : 0;
  }
  holders.sort((a, b) => b.balance - a.balance);

  return holders;
}
