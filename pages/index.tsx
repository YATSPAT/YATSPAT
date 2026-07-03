import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSiws } from "../hooks/useSiws";
import LivePipelines from "../components/LivePipelines";
import { formatInterval } from "../lib/schedule";

type RuleType = "burn" | "buy-burn" | "distribute" | "send";

interface DraftRule {
  type: RuleType;
  pct: number;
  targetMint?: string;
  targetWallet?: string;
  holderMint?: string;
}

interface Draft {
  claimCreatorFees?: boolean;
  sourceMint?: string;
  sourceWallet?: string;
  rules?: DraftRule[];
  intervalMinutes?: number;
  dropThresholdSol?: number;
  readyToDeploy?: boolean;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const RULE_LABEL: Record<RuleType, string> = {
  "buy-burn": "Swap → Burn",
  burn: "Burn tokens",
  distribute: "Increase ATA holders",
  send: "Send to wallet",
};

const GREETING =
  "Hi! I'll set up your ATA growth pipeline — it collects Pump.fun creator rewards as SOL and uses them to grow your token's holder count automatically. Are you collecting Pump.fun creator rewards, or is the SOL/token source something else?";

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
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.5]"
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

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { signedIn, signing, signIn, signOut } = useSiws();

  const [turns, setTurns] = useState<ChatTurn[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [keypair, setKeypair] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  const rulesOk = (draft.rules?.length || 0) > 0 && rulesTotal(draft.rules) === 100;
  const sourceOk = draft.claimCreatorFees === true || (draft.claimCreatorFees === false && !!draft.sourceMint?.trim());
  const walletOk = !!(draft.sourceWallet?.trim() || (connected && publicKey));
  const keypairOk = !!keypair.trim();
  const configComplete = sourceOk && rulesOk && walletOk;
  const canDeploy = configComplete && keypairOk && draft.readyToDeploy === true;

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns(nextTurns);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextTurns.map((t) => ({ role: t.role, content: t.content })),
          draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "chat request failed");

      setDraft((prev) => ({ ...prev, ...data.draftPatch }));
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setTurns((prev) => [...prev, { role: "assistant", content: `⚠️ ${err.message} — try again.` }]);
    } finally {
      setSending(false);
    }
  };

  const deploy = async () => {
    const wallet = draft.sourceWallet?.trim() || publicKey?.toBase58() || "";
    setDeploying(true);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMint: draft.sourceMint?.trim() || "",
          sourceWallet: wallet,
          claimCreatorFees: draft.claimCreatorFees === true,
          rules: (draft.rules || []).filter((r) => r.pct > 0).map((r) => ({
            type: r.type,
            pct: r.pct,
            targetMint: (r.targetMint || "").trim(),
            targetWallet: (r.targetWallet || "").trim(),
            holderMint: (r.holderMint || "").trim(),
          })),
          cron: draft.intervalMinutes || 60,
          dropThresholdSol: draft.dropThresholdSol ?? undefined,
          keypair: keypair.trim(),
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

  const resetAll = () => {
    setTurns([{ role: "assistant", content: GREETING }]);
    setDraft({});
    setKeypair("");
    setDeployResult(null);
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-surface-900 via-surface-900 to-purple-900/40 overflow-hidden">
      <CircuitBackground />

      <header className="fixed top-0 inset-x-0 z-50 glass-card rounded-none border-b border-slate-700/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white tracking-tight">Wen Stimmy?</h1>
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <span className="hidden sm:inline">ATA Holder Growth Panel</span>
                <span className="px-1.5 py-px rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] uppercase tracking-wider">MAINNET</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

      <section className="relative max-w-6xl mx-auto pt-32 pb-16 px-4">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-8 max-w-xl">
          Increase Token Account Holders
        </h2>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-4">
            {!deployResult?.ok && (
              <div className="glass-card p-0 overflow-hidden flex flex-col" style={{ height: "560px" }}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
                  {turns.map((t, i) => (
                    <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          t.role === "user"
                            ? "bg-gradient-to-br from-fuchsia-500/25 to-cyan-500/20 border border-fuchsia-400/30 text-white"
                            : "bg-surface-800/70 border border-slate-700/40 text-slate-200"
                        }`}
                      >
                        {t.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl px-4 py-2.5 text-sm bg-surface-800/70 border border-slate-700/40 text-slate-400">
                        Thinking…
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-700/40 space-y-3">
                  {configComplete && !draft.readyToDeploy && (
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">Operations wallet keypair (required to deploy — never sent to chat)</label>
                      <input
                        type="password"
                        className="glass-input font-mono text-sm"
                        value={keypair}
                        onChange={(e) => setKeypair(e.target.value)}
                        placeholder="Paste private key (base58)"
                      />
                    </div>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage(input);
                    }}
                  >
                    <input
                      className="glass-input text-sm flex-1"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={connected && !draft.sourceWallet ? `e.g. "yes, use ${publicKey?.toBase58().slice(0, 6)}…"` : "Type your answer…"}
                      disabled={sending}
                    />
                    <button className="btn-primary shrink-0" type="submit" disabled={sending || !input.trim()}>
                      Send
                    </button>
                  </form>
                  {canDeploy && (
                    <button className="btn-deploy w-full" onClick={deploy} disabled={deploying}>
                      {deploying ? "Deploying…" : "⚡ Deploy ATA Growth Job"}
                    </button>
                  )}
                  {deployResult && !deployResult.ok && (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 text-xs">
                      {deployResult.error || "Deploy failed"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {deployResult?.ok && (
              <div className="glass-card p-8 text-center space-y-5">
                <div className="text-5xl">✅</div>
                <h2 className="text-2xl font-bold text-white">ATA Growth Job Live</h2>
                <p className="text-slate-300 text-sm">
                  {(draft.rules || []).filter((r) => r.pct > 0).length} rule{(draft.rules || []).filter((r) => r.pct > 0).length === 1 ? "" : "s"} → check every {formatInterval(draft.intervalMinutes || 60)}
                </p>
                {deployResult.message && (
                  <div className="p-3 rounded-xl text-sm bg-emerald-500/5 border border-emerald-500/20 text-emerald-300">
                    {deployResult.message}
                  </div>
                )}
                <div className="p-4 rounded-xl bg-surface-800/60 border border-slate-700/30 text-xs text-slate-300 text-left space-y-2">
                  <div className="flex justify-between"><span>Job ID</span><span className="text-white font-mono">{deployResult.id?.slice(0, 8)}…</span></div>
                  <div className="flex justify-between"><span>Schedule</span><span className="text-cyan-300 font-mono">every {formatInterval(draft.intervalMinutes || 60)}</span></div>
                  <p className="text-[10px] text-emerald-400 pt-1">It will collect, wait for the SOL threshold, then increase ATA holder count automatically.</p>
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
                  <span className="text-slate-400">Funding source</span>
                  <span className={sourceOk ? "text-emerald-400" : "text-amber-400"}>
                    {draft.claimCreatorFees === true
                      ? "Creator rewards (SOL)"
                      : draft.claimCreatorFees === false
                      ? draft.sourceMint
                        ? `${draft.sourceMint.slice(0, 6)}…`
                        : "Pending mint"
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Wallet</span>
                  <span className={walletOk ? "text-emerald-400" : "text-amber-400"}>
                    {draft.sourceWallet
                      ? `${draft.sourceWallet.slice(0, 6)}…`
                      : connected
                      ? "Use connected"
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Keypair</span>
                  <span className={keypairOk ? "text-emerald-400" : "text-amber-400"}>{keypairOk ? "Provided" : "Required"}</span>
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
                  <span>Ready to deploy:</span>
                  <span className={canDeploy ? "text-emerald-400" : "text-amber-400"}>{canDeploy ? "Yes" : "Not yet"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
                    style={{
                      width: `${
                        ([sourceOk, rulesOk, walletOk, keypairOk, draft.readyToDeploy === true].filter(Boolean).length / 5) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <LivePipelines />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
