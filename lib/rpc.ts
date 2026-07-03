import { Connection } from "@solana/web3.js";

/* Shared mainnet RPC — Helius when configured (reliable), public RPC otherwise. */
export function rpcUrl(): string {
  const key = process.env.HELIUS_API_KEY || "";
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
}

export function getConnection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}
