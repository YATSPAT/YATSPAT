import { Connection, PublicKey } from "@solana/web3.js";

/* ── Pump.fun fee sharing (the `pump_fees` program) ──────────────────
   The correct way to collect a creator-fee cut WITHOUT holding the coin
   creator's private key: the creator sets up a SharingConfig (per mint)
   that splits creator fees among up to 10 shareholder wallets by basis
   points. A pipeline's own generated wallet is added as a shareholder;
   the permissionless distribute crank then routes its bps share to it.

   This module is read-only: derive the config PDA, parse it, and answer
   "is this wallet a shareholder, and for how many bps" — used to VERIFY
   a pipeline is actually entitled to fees before it's deployed, so a
   misconfigured pipeline fails loudly instead of silently collecting 0.

   Layout + program ID are taken from the official pump_fees IDL, not the
   community docs (whose memcmp offset for `mint` was wrong). */

export const PUMP_FEES_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

// SharingConfig account discriminator (first 8 bytes) — anchor account tag.
const SHARING_CONFIG_DISCRIMINATOR = Uint8Array.from([216, 74, 9, 0, 56, 140, 93, 75]);

export interface Shareholder {
  address: string;
  shareBps: number; // basis points, all shareholders sum to 10_000
}

export interface SharingConfig {
  address: string; // the config PDA
  version: number;
  mint: string;
  admin: string; // the fee-sharing authority (creator, initially)
  adminRevoked: boolean;
  shareholders: Shareholder[];
}

/* PDA seeds are ["sharing-config", mint] under the pump_fees program. */
export function sharingConfigPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sharing-config"), mint.toBuffer()],
    PUMP_FEES_PROGRAM_ID
  );
  return pda;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/* Fetch and decode the SharingConfig for a mint. Returns null when the
   creator has not set up fee sharing for this token (no account at the PDA).
   Struct (from pump_fees IDL):
     discriminator(8) bump(1) version(1) status(1) mint(32) admin(32)
     admin_revoked(1) shareholders: vec<{address(32), share_bps(u16)}> */
export async function getSharingConfig(
  connection: Connection,
  mint: PublicKey
): Promise<SharingConfig | null> {
  const pda = sharingConfigPda(mint);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) return null;

  const data = info.data;
  // Guard: must be the pump_fees program and carry the SharingConfig tag.
  if (!info.owner.equals(PUMP_FEES_PROGRAM_ID)) return null;
  if (data.length < 76) return null;
  if (!arraysEqual(Uint8Array.prototype.slice.call(data, 0, 8), SHARING_CONFIG_DISCRIMINATOR)) {
    return null;
  }

  let o = 8;
  o += 1; // bump
  const version = data[o]; o += 1;
  o += 1; // status (ConfigStatus enum discriminant)
  const mintPk = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const admin = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const adminRevoked = data[o] !== 0; o += 1;

  const count = data.readUInt32LE(o); o += 4;
  const shareholders: Shareholder[] = [];
  for (let i = 0; i < count; i += 1) {
    if (o + 34 > data.length) break; // defensive: truncated account
    const address = new PublicKey(data.subarray(o, o + 32)).toBase58(); o += 32;
    const shareBps = data.readUInt16LE(o); o += 2;
    shareholders.push({ address, shareBps });
  }

  return {
    address: pda.toBase58(),
    version,
    mint: mintPk.toBase58(),
    admin: admin.toBase58(),
    adminRevoked,
    shareholders,
  };
}

/* How many bps of `mint`'s creator fees the given wallet is entitled to.
   0 when there's no config, or the wallet isn't a shareholder. */
export function shareholderBps(config: SharingConfig | null, wallet: string): number {
  if (!config) return 0;
  const entry = config.shareholders.find((s) => s.address === wallet);
  return entry ? entry.shareBps : 0;
}

export interface EntitlementCheck {
  configured: boolean;   // does the mint have a SharingConfig at all
  isShareholder: boolean;
  shareBps: number;
  admin?: string;
  reason: string;
}

/* Deploy-time validation: confirm a pipeline's wallet will actually receive
   a share before we let the pipeline go live. */
export async function checkEntitlement(
  connection: Connection,
  mint: PublicKey,
  wallet: string
): Promise<EntitlementCheck> {
  const config = await getSharingConfig(connection, mint);
  if (!config) {
    return {
      configured: false,
      isShareholder: false,
      shareBps: 0,
      reason: "No fee-sharing config exists for this mint. The creator must create one and add this wallet as a shareholder.",
    };
  }
  const bps = shareholderBps(config, wallet);
  if (bps <= 0) {
    return {
      configured: true,
      isShareholder: false,
      shareBps: 0,
      admin: config.admin,
      reason: `Fee sharing exists but this wallet is not a shareholder. The config admin (${config.admin.slice(0, 8)}…) must add it via update_fee_shares.`,
    };
  }
  return {
    configured: true,
    isShareholder: true,
    shareBps: bps,
    admin: config.admin,
    reason: `Entitled to ${(bps / 100).toFixed(2)}% of creator fees for this mint.`,
  };
}
