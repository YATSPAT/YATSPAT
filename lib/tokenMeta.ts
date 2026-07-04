/* ── Token name + image lookup via Helius DAS getAssetBatch ──────────
   Used to show a token as a card (name + image) in the live-pipes carousel.
   Never throws — on any failure (no key, RPC error) it returns an empty map
   and callers fall back to the short mint + a placeholder. */

export interface TokenMeta {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
}

function pickImage(content: any): string | null {
  if (!content) return null;
  return (
    content.links?.image ||
    content.files?.[0]?.cdn_uri ||
    content.files?.[0]?.uri ||
    null
  );
}

export async function fetchTokenMeta(mints: string[]): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  const ids = Array.from(new Set(mints.filter(Boolean)));
  if (!ids.length) return out;

  const key = process.env.HELIUS_API_KEY || "";
  if (!key) return out; // no metadata source — callers degrade to short mint

  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "token-meta",
        method: "getAssetBatch",
        params: { ids: ids.slice(0, 1000) },
      }),
    });
    if (!res.ok) return out;
    const json = await res.json();
    const assets: any[] = Array.isArray(json?.result) ? json.result : [];
    for (const a of assets) {
      if (!a?.id) continue;
      const md = a.content?.metadata || {};
      out.set(a.id, {
        mint: a.id,
        name: md.name || md.symbol || a.token_info?.symbol || "",
        symbol: md.symbol || a.token_info?.symbol || "",
        image: pickImage(a.content),
      });
    }
  } catch {
    // swallow — degrade gracefully
  }
  return out;
}

export interface TokenInfoFull extends TokenMeta {
  decimals: number | null;
  supply: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
}

/* Richer per-token lookup for the HUD: metadata + supply + price + market cap
   (Helius DAS getAssetBatch with showFungible). Same graceful degradation. */
export async function fetchTokenInfoBatch(mints: string[]): Promise<Map<string, TokenInfoFull>> {
  const out = new Map<string, TokenInfoFull>();
  const ids = Array.from(new Set(mints.filter(Boolean)));
  if (!ids.length) return out;

  const key = process.env.HELIUS_API_KEY || "";
  if (!key) return out;

  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "token-info",
        method: "getAssetBatch",
        params: { ids: ids.slice(0, 100), options: { showFungible: true } },
      }),
    });
    if (!res.ok) return out;
    const json = await res.json();
    const assets: any[] = Array.isArray(json?.result) ? json.result : [];
    for (const a of assets) {
      if (!a?.id) continue;
      const md = a.content?.metadata || {};
      const ti = a.token_info || {};
      const decimals = typeof ti.decimals === "number" ? ti.decimals : null;
      const supply = typeof ti.supply === "number" ? ti.supply : null;
      const priceUsd = ti.price_info?.price_per_token ?? null;
      let marketCapUsd: number | null = null;
      if (priceUsd != null && supply != null && decimals != null) {
        marketCapUsd = priceUsd * (supply / Math.pow(10, decimals));
      }
      out.set(a.id, {
        mint: a.id,
        name: md.name || md.symbol || ti.symbol || "",
        symbol: md.symbol || ti.symbol || "",
        image: pickImage(a.content),
        decimals,
        supply,
        priceUsd,
        marketCapUsd,
      });
    }
  } catch {
    // swallow
  }
  return out;
}
