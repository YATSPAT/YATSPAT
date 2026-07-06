import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { encryptKeypair, decryptKeypair, type EncryptedKeypair } from "./crypto";

/* ── Generate a pipeline's operations wallet server-side ──────────────
   Sole-receiver fee routing: the panel creates a fresh, single-use wallet
   the creator sets as their token's fee receiver. The private key is generated
   here, encrypted at rest immediately, and never returned to the client — only
   the public key is surfaced for Pump.fun fee-receiver setup. */

export interface GeneratedWallet {
  publicKey: string;
  encryptedKeypair: EncryptedKeypair;
}

export function generatePipelineWallet(): GeneratedWallet {
  const kp = Keypair.generate();
  // Store the same format the executor expects to decrypt + reload: base58 secret key.
  const secretBase58 = bs58.encode(kp.secretKey);
  return {
    publicKey: kp.publicKey.toBase58(),
    encryptedKeypair: encryptKeypair(secretBase58),
  };
}

/* Reload a stored wallet's keypair — mirrors what the executor does, exposed
   for a withdraw/verify path. Decryption requires KEYPAIR_ENCRYPTION_KEY, so
   this only works server-side. */
export function loadPipelineWallet(enc: EncryptedKeypair): Keypair {
  return Keypair.fromSecretKey(bs58.decode(decryptKeypair(enc)));
}
