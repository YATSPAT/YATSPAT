import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSiws } from "../hooks/useSiws";
import LivePipelines from "../components/LivePipelines";
import { formatInterval, SCHEDULE_PRESETS } from "../lib/schedule";

type RuleType = "burn" | "buy-burn" | "distribute" | "send";

interface DraftRule {
  type: RuleType;
  pct: number;
  targetMint?: string;
  targetWallet?: string;
  holderMint?: string;
}

interface Draft {
  feeMint?: string;
  rules?: DraftRule[];
  intervalMinutes?: number;
  dropThresholdSol?: number;
}

const RULE_LABEL: Record<RuleType, string> = {
  "buy-burn": "Swap → Burn",
  burn: "Burn tokens",
  distribute: "Increase ATA holders",
  send: "Send to wallet",
};

// Which rule actions the form offers, with the value-prop framing.
const RULE_OPTIONS: { type: RuleType; label: string; hint: string }[] = [
  { type: "distribute", label: "📣 Airdrop to holders", hint: "Send the swapped token to holders of another token (Exposure) or your own (Rewards)." },
  { type: "buy-burn", label: "🔥 Buy back & burn", hint: "Swap fees into a token and burn it forever (Deflation)." },
  { type: "send", label: "💸 Send to a wallet", hint: "Route the SOL straight to a wallet you choose." },
];

const newRule = (): DraftRule => ({ type: "distribute", pct: 0, targetMint: "", targetWallet: "", holderMint: "" });

function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="reflector-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d946ef" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#reflector-logo-grad)" opacity="0.18" />
      <path d="M13 9h9.5a6.5 6.5 0 0 1 3 12.3L31 31h-5.4l-4.7-8.7H17V31h-4V9Zm4 3.4v6.4h5.3a3.2 3.2 0 0 0 0-6.4H17Z" fill="url(#reflector-logo-grad)" />
    </svg>
  );
}

function CircuitBackground() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.18]"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <pattern id="circuit-dots" width="46" height="46" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.4" fill="#22d3ee" opacity="0.7" />
          <path d="M1 1 L1 23 L23 23 L23 45" stroke="#22d3ee" strokeWidth="0.6" opacity="0.32" fill="none" />
        </pattern>
        <radialGradient id="circuit-fade" cx="80%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="circuit-mask">
          <rect width="100%" height="100%" fill="url(#circuit-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit-dots)" mask="url(#circuit-mask)" />
    </svg>
  );
}

function rulesTotal(rules?: DraftRule[]): number {
  return (rules || []).reduce((s, r) => s + (r.pct || 0), 0);
}

// ── Our token. ──
const STIMMY = {
  ticker: "$STIMMY",
  mint: "6VVfQ7Y3qBEDi4ybx3QwzPYvjp93qWkcEdHbf1SXpump",
  x: "https://x.com/wenstimmyfun",
  telegram: "",
  blurb:
    "The token behind the panel. Wen Stimmy runs its own Pump.fun creator fees through this exact tool — the airdrop machine eating its own cooking.",
};

function shortMint(m: string): string {
  return m.length > 12 ? `${m.slice(0, 5)}…${m.slice(-5)}` : m;
}

function TokenDetails() {
  const hasMint = STIMMY.mint.trim().length > 0;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 leading-relaxed">{STIMMY.blurb}</p>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">Ticker</span>
        <span className="text-white font-mono text-xs">{STIMMY.ticker}</span>
      </div>
      <div>
        <span className="text-slate-400 text-xs block mb-1">Contract</span>
        {hasMint ? (
          <div className="flex gap-2">
            <code className="glass-input font-mono text-[11px] flex-1 break-all py-1.5">{shortMint(STIMMY.mint)}</code>
            <button className="btn-secondary text-xs shrink-0 py-1.5 px-3" onClick={() => navigator.clipboard?.writeText(STIMMY.mint)}>
              Copy
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-fuchsia-500/10 border border-fuchsia-400/25 text-fuchsia-200 text-xs font-medium">
            🚀 Not launched yet
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {hasMint && (
          <a href={`https://pump.fun/coin/${STIMMY.mint}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-xs hover:bg-fuchsia-500/25 transition">
            Pump.fun ↗
          </a>
        )}
        {hasMint && (
          <a href={`https://solscan.io/token/${STIMMY.mint}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-surface-800 border border-slate-700/50 text-slate-300 text-xs hover:border-slate-500/60 transition">
            Solscan ↗
          </a>
        )}
        {STIMMY.x && (
          <a href={STIMMY.x} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-surface-800 border border-slate-700/50 text-slate-300 text-xs hover:border-slate-500/60 transition">
            𝕏 ↗
          </a>
        )}
        {STIMMY.telegram && (
          <a href={STIMMY.telegram} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-surface-800 border border-slate-700/50 text-slate-300 text-xs hover:border-slate-500/60 transition">
            Telegram ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { signedIn, signing, signIn, signOut } = useSiws();

  const [draft, setDraft] = useState<Draft>({ rules: [{ ...newRule(), pct: 100 }], intervalMinutes: 60 });
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const rules = draft.rules || [];
  const setRules = (r: DraftRule[]) => setDraft((d) => ({ ...d, rules: r }));
  const addRule = () => setRules([...rules, newRule()]);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<DraftRule>) =>
    setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const total = rulesTotal(rules);
  const rulesOk = rules.length > 0 && total === 100;
  const mintOk = !!draft.feeMint?.trim();
  const canCreate = mintOk && rulesOk;
  const activated = activateResult?.activated === true;

  const deploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeMint: draft.feeMint?.trim() || "",
          rules: (draft.rules || []).filter((r) => r.pct > 0).map((r) => ({
            type: r.type,
            pct: r.pct,
            targetMint: (r.targetMint || "").trim(),
            targetWallet: (r.targetWallet || "").trim(),
            holderMint: (r.holderMint || "").trim(),
          })),
          cron: draft.intervalMinutes || 60,
          dropThresholdSol: draft.dropThresholdSol ?? undefined,
          ownerAddress: signedIn ? publicKey?.toBase58() : undefined,
        }),
      });
      const data = await res.json();
      setDeployResult(data);
    } catch (err: any) {
      setDeployResult({ ok: false, error: err.message });
    } finally {
      setDeploying(false);
    }
  };

  const activate = async () => {
    if (!deployResult?.id) return;
    setActivating(true);
    try {
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deployResult.id }),
      });
      const data = await res.json();
      setActivateResult(data);
    } catch (err: any) {
      setActivateResult({ ok: false, error: err.message });
    } finally {
      setActivating(false);
    }
  };

  const resetAll = () => {
    setDraft({ rules: [{ ...newRule(), pct: 100 }], intervalMinutes: 60 });
    setDeployResult(null);
    setActivateResult(null);
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-surface-900 via-surface-900 to-purple-900/40 overflow-hidden">
      <CircuitBackground />

      <header className="fixed top-0 inset-x-0 z-50 glass-card rounded-none border-b border-slate-700/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open token menu"
              className="btn-secondary !p-2.5 !rounded-xl shrink-0"
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5 text-slate-200" fill="none">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <Logo className="w-10 h-10 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <span className="block text-lg font-bold text-white tracking-tight">Wen Stimmy?</span>
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <span className="hidden sm:inline">ATA Holder Growth Panel</span>
                <span className="px-1.5 py-px rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] uppercase tracking-wider">MAINNET</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Social links (mirrors the sidebar) */}
            <div className="hidden sm:flex items-center gap-1.5">
              <a href={STIMMY.x} target="_blank" rel="noopener noreferrer" title="X / Twitter" className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-700 border border-white/[0.04] text-slate-200 text-sm hover:text-white transition-colors">
                𝕏
              </a>
              <a href={`https://pump.fun/coin/${STIMMY.mint}`} target="_blank" rel="noopener noreferrer" title="Pump.fun" className="w-9 h-9 flex items-center justify-center rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-sm hover:bg-fuchsia-500/25 transition-colors">
                💊
              </a>
              <a href={`https://solscan.io/token/${STIMMY.mint}`} target="_blank" rel="noopener noreferrer" title="Solscan" className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-700 border border-white/[0.04] text-slate-200 text-sm hover:text-white transition-colors">
                🔎
              </a>
            </div>
            <WalletMultiButton style={{ background: connected ? "linear-gradient(135deg, #059669, #10b981)" : "linear-gradient(135deg, #a21caf, #22d3ee)", borderRadius: "0.75rem", height: "2.5rem", fontSize: "0.8rem", padding: "0 0.85rem", whiteSpace: "nowrap" }} />
            {connected && (signedIn ? (
              <button onClick={signOut} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-all">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> SIWS ✓
              </button>
            ) : (
              <button onClick={signIn} disabled={signing} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 transition-all disabled:opacity-50">
                {signing ? "Signing…" : "Sign In With Solana"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Slide-out sidebar (opened from the header menu button) */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-80 max-w-[85vw] transform transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full glass-card rounded-none rounded-r-2xl overflow-y-auto p-5 space-y-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <Logo className="w-8 h-8" />
              <span className="text-base font-bold text-white">Wen Stimmy</span>
            </span>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="text-slate-400 hover:text-white p-1">
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-2.5">Our token</h4>
            <TokenDetails />
          </div>
        </div>
      </aside>

      <section className="relative max-w-6xl mx-auto pt-28 pb-16 px-4">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Build your pipeline</h2>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-600/50 to-transparent" />
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-4">
            {!deployResult?.ok && (
              <form
                className="glass-card p-6 space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canCreate && !deploying) deploy();
                }}
              >
                {/* Token */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1.5">Your token</label>
                  <input
                    className="glass-input font-mono text-sm"
                    value={draft.feeMint || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, feeMint: e.target.value }))}
                    placeholder="Pump.fun token mint address"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">The token whose Pump.fun creator fees this pipeline collects.</p>
                </div>

                {/* Rules */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Where the fees go</label>
                    <span className={`text-xs font-mono ${total === 100 ? "text-emerald-400" : "text-amber-400"}`}>{total}% / 100%</span>
                  </div>

                  <div className="space-y-3">
                    {rules.map((rule, i) => (
                      <div key={i} className="rounded-xl border border-white/[0.05] bg-surface-900/60 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="glass-input text-sm !py-2 flex-1"
                            value={rule.type}
                            onChange={(e) => updateRule(i, { type: e.target.value as RuleType })}
                          >
                            {RULE_OPTIONS.map((o) => (
                              <option key={o.type} value={o.type}>{o.label}</option>
                            ))}
                          </select>
                          {rules.length > 1 && (
                            <button type="button" onClick={() => removeRule(i)} className="text-xs text-rose-400 hover:text-rose-300 px-2 shrink-0">
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={rule.pct}
                            onChange={(e) => updateRule(i, { pct: Math.max(0, Math.min(100, Number(e.target.value))) })}
                            className="flex-1"
                            style={{ background: `linear-gradient(to right, #d946ef ${rule.pct}%, #1e293b ${rule.pct}%)` }}
                          />
                          <span className="w-12 text-right font-mono text-sm text-cyan-300">{rule.pct}%</span>
                        </div>

                        {rule.type === "distribute" && (
                          <>
                            <input
                              className="glass-input font-mono text-xs"
                              value={rule.holderMint || ""}
                              onChange={(e) => updateRule(i, { holderMint: e.target.value })}
                              placeholder="Airdrop to holders of this token mint…"
                            />
                            <input
                              className="glass-input font-mono text-xs"
                              value={rule.targetMint || ""}
                              onChange={(e) => updateRule(i, { targetMint: e.target.value })}
                              placeholder="Token to airdrop (usually your own mint)…"
                            />
                          </>
                        )}
                        {rule.type === "buy-burn" && (
                          <input
                            className="glass-input font-mono text-xs"
                            value={rule.targetMint || ""}
                            onChange={(e) => updateRule(i, { targetMint: e.target.value })}
                            placeholder="Token mint to buy back & burn…"
                          />
                        )}
                        {rule.type === "send" && (
                          <input
                            className="glass-input font-mono text-xs"
                            value={rule.targetWallet || ""}
                            onChange={(e) => updateRule(i, { targetWallet: e.target.value })}
                            placeholder="Destination wallet address…"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addRule}
                    className="mt-3 w-full py-2 rounded-xl border border-dashed border-slate-600/50 text-xs text-slate-400 hover:border-cyan-400/40 hover:text-cyan-300 transition-colors"
                  >
                    + Add another
                  </button>
                  {total !== 100 && <p className="text-xs text-amber-400 mt-2">Percentages must add up to 100%.</p>}
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">How often to check</label>
                  <div className="grid grid-cols-4 gap-2">
                    {SCHEDULE_PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.minutes}
                        onClick={() => setDraft((d) => ({ ...d, intervalMinutes: p.minutes }))}
                        className={`px-2 py-2 rounded-lg text-xs font-mono transition-all ${
                          (draft.intervalMinutes || 60) === p.minutes
                            ? "bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200"
                            : "bg-surface-900/60 border border-slate-700/40 text-slate-300 hover:border-slate-500/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs text-slate-400 mt-4 mb-1.5">SOL drop threshold (optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.dropThresholdSol ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, dropThresholdSol: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    placeholder="0.5 (default)"
                    className="glass-input font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">Fees accumulate until spendable SOL passes this, then a round fires.</p>
                </div>

                <button className="btn-deploy w-full" type="submit" disabled={!canCreate || deploying}>
                  {deploying ? "Creating…" : "⚡ Create pipeline"}
                </button>
                {deployResult && !deployResult.ok && (
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 text-xs">
                    {deployResult.error || "Create failed"}
                  </div>
                )}
              </form>
            )}

            {deployResult?.ok && !activated && (
              <div className="glass-card p-8 space-y-5">
                <div className="text-center">
                  <div className="text-5xl mb-2">🔑</div>
                  <h2 className="text-2xl font-bold text-white">One step left: set your fee receiver</h2>
                </div>
                <p className="text-slate-300 text-sm text-center">
                  The panel generated a dedicated wallet for this pipeline. On Pump.fun, set it as your token&apos;s
                  <span className="text-white font-semibold"> fee receiver</span>, then activate below.
                </p>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Your pipeline wallet (set this as the fee receiver)</label>
                  <div className="flex gap-2">
                    <code className="glass-input font-mono text-xs flex-1 break-all py-2">{deployResult.walletPublicKey}</code>
                    <button
                      className="btn-secondary shrink-0 text-xs"
                      onClick={() => navigator.clipboard?.writeText(deployResult.walletPublicKey)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface-800/60 border border-slate-700/30 text-xs text-slate-300 space-y-2">
                  <div className="flex justify-between"><span>Token</span><span className="text-white font-mono">{deployResult.feeMint?.slice(0, 8)}…</span></div>
                  <div className="flex justify-between"><span>Schedule</span><span className="text-cyan-300 font-mono">every {formatInterval(draft.intervalMinutes || 60)}</span></div>
                  <div className="flex justify-between"><span>Status</span><span className="text-amber-400">Paused — awaiting fee-receiver setup</span></div>
                </div>
                <button className="btn-deploy w-full" onClick={activate} disabled={activating}>
                  {activating ? "Verifying on-chain…" : "✓ I've set it — Activate"}
                </button>
                {activateResult && !activateResult.activated && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs">
                    {activateResult.error
                      ? activateResult.error
                      : activateResult.entitlement?.reason || "This wallet isn't the token's fee receiver yet. Set it on Pump.fun, then try again."}
                  </div>
                )}
                <button className="btn-secondary w-full" onClick={resetAll}>← Start New</button>
              </div>
            )}

            {activated && (
              <div className="glass-card p-8 text-center space-y-5">
                <div className="text-5xl">✅</div>
                <h2 className="text-2xl font-bold text-white">Pipeline Live</h2>
                <p className="text-slate-300 text-sm">
                  {(draft.rules || []).filter((r) => r.pct > 0).length} rule{(draft.rules || []).filter((r) => r.pct > 0).length === 1 ? "" : "s"} → check every {formatInterval(draft.intervalMinutes || 60)}
                </p>
                <div className="p-4 rounded-xl bg-surface-800/60 border border-slate-700/30 text-xs text-slate-300 text-left space-y-2">
                  <div className="flex justify-between"><span>Job ID</span><span className="text-white font-mono">{deployResult.id?.slice(0, 8)}…</span></div>
                  <div className="flex justify-between"><span>Your share</span><span className="text-emerald-300 font-mono">{((activateResult?.entitlement?.shareBps ?? 0) / 100).toFixed(2)}%</span></div>
                  <p className="text-[10px] text-emerald-400 pt-1">It will collect creator fees, wait for the SOL threshold, then increase ATA holder count automatically.</p>
                </div>
                <button className="btn-secondary" onClick={resetAll}>← Start New</button>
              </div>
            )}
          </div>

          {/* HUD side panel — reacts to the draft the chat has extracted so far */}
          <div className="hidden lg:block sticky top-32">
            <div className="hud-panel">
              <h4 className="text-sm font-bold text-cyan-300 tracking-wide mb-3">Configuration HUD</h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Token</span>
                  <span className={mintOk ? "text-emerald-400" : "text-amber-400"}>
                    {draft.feeMint ? `${draft.feeMint.slice(0, 6)}…` : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pipeline wallet</span>
                  <span className={deployResult?.walletPublicKey ? "text-emerald-400" : "text-slate-500"}>
                    {deployResult?.walletPublicKey ? `${deployResult.walletPublicKey.slice(0, 6)}…` : "Generated on create"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Activation</span>
                  <span className={activated ? "text-emerald-400" : "text-amber-400"}>
                    {activated ? "Live" : deployResult?.ok ? "Awaiting fee receiver" : "Pending"}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-700/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-400">Growth rules</span>
                    <span className={rulesOk ? "text-emerald-400" : "text-amber-400"}>{rulesTotal(draft.rules)}%</span>
                  </div>
                  {(draft.rules || []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-slate-300 py-0.5">
                      <span>{RULE_LABEL[r.type]}</span>
                      <span className="font-mono text-cyan-300">{r.pct}%</span>
                    </div>
                  ))}
                  {!draft.rules?.length && <p className="text-[11px] text-slate-500">No rules yet</p>}
                </div>

                <div className="pt-2 border-t border-slate-700/40">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Check interval</span>
                    <span className="text-white font-mono">{draft.intervalMinutes ? formatInterval(draft.intervalMinutes) : "default (1h)"}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-400">Drop threshold</span>
                    <span className="text-white font-mono">{draft.dropThresholdSol ?? "0.5"} SOL</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/40">
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
                  <span>Progress:</span>
                  <span className={activated ? "text-emerald-400" : "text-amber-400"}>{activated ? "Live" : canCreate ? "Ready to create" : "Configuring"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
                    style={{
                      width: `${
                        ([mintOk, rulesOk, deployResult?.ok, activated].filter(Boolean).length / 4) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live pipes — horizontal row along the bottom */}
        <div className="mt-6">
          <LivePipelines horizontal />
        </div>
      </section>

      <footer className="relative border-t border-slate-800/60 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo className="w-7 h-7" />
            <span className="text-sm text-slate-400">
              <span className="text-slate-200 font-semibold">Wen Stimmy</span> · Automated holder growth
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Mainnet
            </span>
            <span>Non-custodial</span>
            <span>Powered by Pump.fun fee sharing</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
