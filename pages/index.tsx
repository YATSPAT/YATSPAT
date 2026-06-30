import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSiws } from "../hooks/useSiws";

type Step = "source" | "split" | "schedule" | "done";
type RuleType = "burn" | "buy-burn" | "distribute" | "send";

interface SplitRule {
  id: string;
  type: RuleType;
  pct: number;
  targetMint: string;
  targetWallet: string;
  holderMint: string;
}

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { signedIn, signing, signIn, signOut } = useSiws();

  const [step, setStep] = useState<Step>("source");
  const [sourceMint, setSourceMint] = useState("");
  const [sourceWallet, setSourceWallet] = useState("");
  const [creatorKeypair, setCreatorKeypair] = useState("");
  const [cronExpr, setCronExpr] = useState("every 5m");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);

  const [rules, setRules] = useState<SplitRule[]>([
    { id: "1", type: "buy-burn", pct: 50, targetMint: "", targetWallet: "", holderMint: "" },
    { id: "2", type: "distribute", pct: 50, targetMint: "", targetWallet: "", holderMint: "" },
  ]);

  const totalPct = useMemo(() => rules.reduce((s, r) => s + r.pct, 0), [rules]);
  const addRule = () => setRules([...rules, { id: String(Date.now()), type: "burn", pct: 0, targetMint: "", targetWallet: "", holderMint: "" }]);
  const removeRule = (id: string) => setRules(rules.filter((r) => r.id !== id));
  const updateRule = (id: string, p: Partial<SplitRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));

  /* ── Deploy: one atomic call. On localhost, files auto-saved. On Vercel, keypair downloads. ── */
  const deploy = async () => {
    const wallet = sourceWallet.trim() || publicKey?.toBase58() || "";
    const isLocal = typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    setDeploying(true);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMint: sourceMint.trim(),
          sourceWallet: wallet,
          network: "mainnet",
          rules: rules.filter(r => r.pct > 0).map(r => ({
            type: r.type, pct: r.pct,
            targetMint: r.targetMint.trim(),
            targetWallet: r.targetWallet.trim(),
            holderMint: r.holderMint.trim(),
          })),
          cron: cronExpr,
          keypair: creatorKeypair.trim() || undefined,
        }),
      });
      const data = await res.json();

      // Remote: auto-download keypair if server didn't save it
      if (!isLocal && creatorKeypair.trim() && !data.files?.includes("creator-keypair.json")) {
        const blob = new Blob([creatorKeypair.trim()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "creator-keypair.json"; a.click();
        URL.revokeObjectURL(url);
        data.downloaded = true;
      }

      setSourceWallet(wallet);
      setDeployResult(data);
      setStep("done");
    } catch (err: any) {
      setDeployResult({ ok: false, error: err.message });
      setStep("done");
    } finally {
      setDeploying(false);
    }
  };

  const resetAll = () => {
    setStep("source");
    setSourceMint("");
    setSourceWallet("");
    setCreatorKeypair("");
    setRules([
      { id: "1", type: "buy-burn", pct: 50, targetMint: "", targetWallet: "", holderMint: "" },
      { id: "2", type: "distribute", pct: 50, targetMint: "", targetWallet: "", holderMint: "" },
    ]);
    setCronExpr("every 5m");
    setDeployResult(null);
  };

  const cardClasses = (s: Step) => {
    const order: Step[] = ["source", "split", "schedule", "done"];
    if (step === s) return "glass-card p-6 ring-2 ring-brand-500/40 transition-all";
    if (order.indexOf(step) > order.indexOf(s)) return "glass-card p-6 opacity-60 transition-all";
    return "glass-card p-6 opacity-40 pointer-events-none transition-all";
  };
  const badgeClasses = (s: Step) => {
    const order: Step[] = ["source", "split", "schedule", "done"];
    if (step === s) return "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 bg-brand-500/20 text-brand-400";
    if (order.indexOf(step) > order.indexOf(s)) return "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 bg-emerald-500/20 text-emerald-400";
    return "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 bg-surface-800 text-slate-600";
  };
  const badgeText = (s: Step) => {
    const order: Step[] = ["source", "split", "schedule", "done"];
    return order.indexOf(step) > order.indexOf(s) ? "✓" : String(order.indexOf(s) + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-brand-950/40">
      <header className="fixed top-0 inset-x-0 z-50 glass-card rounded-none border-b border-slate-700/30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xl shadow-lg shadow-brand-500/30">⟡</div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Reflector</h1>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                Reflection Token Panel
                <span className="px-1.5 py-px rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] uppercase tracking-wider">MAINNET</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WalletMultiButton style={{ background: connected ? "linear-gradient(135deg, #059669, #10b981)" : "linear-gradient(135deg, #4f46e5, #6366f1)", borderRadius: "0.75rem", height: "2.5rem", fontSize: "0.875rem", padding: "0 1rem" }} />
            {connected && (signedIn ? (
              <button onClick={signOut} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-all">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> SIWS ✓
              </button>
            ) : (
              <button onClick={signIn} disabled={signing} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-medium hover:bg-brand-500/25 transition-all disabled:opacity-50">
                {signing ? "Signing…" : "Sign In With Solana"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto pt-32 pb-24 px-4 space-y-8">

        {/* Step 1 */}
        <div className={cardClasses("source")}>
          <div className="flex items-start gap-4 mb-5">
            <div className={badgeClasses("source")}>{badgeText("source")}</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Reward Source</h3>
              <p className="text-sm text-slate-400">What token are you collecting rewards from, and which wallet holds them?</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Reward Token Mint</label>
              <input className="glass-input font-mono text-sm" value={sourceMint} onChange={(e) => setSourceMint(e.target.value)} placeholder="SPL mint — e.g. your Pump.fun creator rewards token" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Creator Wallet Address</label>
              <input className="glass-input font-mono text-sm" value={sourceWallet} onChange={(e) => setSourceWallet(e.target.value)} placeholder={connected ? publicKey?.toBase58() || "Connect wallet to auto-fill" : "Connect wallet to auto-fill"} />
              {connected && !sourceWallet && (
                <button className="text-xs text-brand-400 mt-1 hover:underline" onClick={() => setSourceWallet(publicKey!.toBase58())}>Use connected wallet</button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Creator Wallet Keypair</label>
              <input type="password" className="glass-input font-mono text-sm" value={creatorKeypair} onChange={(e) => setCreatorKeypair(e.target.value)} placeholder="Paste private key (base58) for auto-execution" />
              <p className="text-[10px] text-slate-500 mt-1">Stays local. Never sent to any server in production.</p>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep("split")} disabled={!sourceMint.trim()}>Continue →</button>
          </div>
        </div>

        {/* Step 2 */}
        <div className={cardClasses("split")}>
          <div className="flex items-start gap-4 mb-5">
            <div className={badgeClasses("split")}>{badgeText("split")}</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Split Rules</h3>
              <p className="text-sm text-slate-400">Divide rewards any number of ways.</p>
            </div>
          </div>
          <div className="space-y-4">
            {rules.map((rule, i) => (
              <div key={rule.id} className="p-4 rounded-xl bg-surface-800/60 border border-slate-700/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rule {i + 1}</span>
                  {rules.length > 1 && <button onClick={() => removeRule(rule.id)} className="text-xs text-rose-400 hover:text-rose-300">Remove</button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Action</label>
                    <select className="glass-input text-sm" value={rule.type} onChange={(e) => updateRule(rule.id, { type: e.target.value as RuleType })}>
                      <option value="buy-burn">🔄 Swap → Burn</option>
                      <option value="burn">🔥 Burn tokens</option>
                      <option value="distribute">📤 Distribute to holders</option>
                      <option value="send">💸 Send to wallet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">%</label>
                    <input type="number" className="glass-input text-sm" value={rule.pct} onChange={(e) => updateRule(rule.id, { pct: Math.min(100, Math.max(0, Number(e.target.value))) })} min={0} max={100} />
                  </div>
                </div>
                {(rule.type !== "burn") && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      {rule.type === "buy-burn" ? "Swap into (then burn)" : rule.type === "distribute" ? "Token to distribute" : "Token to send"}
                    </label>
                    <input className="glass-input font-mono text-xs" value={rule.targetMint} onChange={(e) => updateRule(rule.id, { targetMint: e.target.value })} placeholder="SPL mint…" />
                  </div>
                )}
                {rule.type === "send" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Destination</label>
                    <input className="glass-input font-mono text-xs" value={rule.targetWallet} onChange={(e) => updateRule(rule.id, { targetWallet: e.target.value })} placeholder="Wallet…" />
                  </div>
                )}
                {rule.type === "distribute" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Snapshot holders of</label>
                    <input className="glass-input font-mono text-xs" value={rule.holderMint} onChange={(e) => updateRule(rule.id, { holderMint: e.target.value })} placeholder="Token mint whose holders receive…" />
                  </div>
                )}
              </div>
            ))}
            <button onClick={addRule} className="w-full py-2 rounded-xl border border-dashed border-slate-600/50 text-xs text-slate-500 hover:border-brand-500/40 hover:text-brand-400 transition-all">+ Add Rule</button>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <span className={`font-mono font-bold ${totalPct === 100 ? "text-emerald-400" : "text-rose-400"}`}>{totalPct}%</span>
            </div>
            {totalPct !== 100 && <p className="text-xs text-rose-400">Must add up to 100%</p>}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep("source")}>← Back</button>
              <button className="btn-primary flex-1" onClick={() => setStep("schedule")} disabled={totalPct !== 100 || rules.length === 0}>Continue →</button>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className={cardClasses("schedule")}>
          <div className="flex items-start gap-4 mb-5">
            <div className={badgeClasses("schedule")}>{badgeText("schedule")}</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Schedule</h3>
              <p className="text-sm text-slate-400">How often should the pipeline check for rewards and execute?</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {["every 5m", "every 15m", "every 30m", "every 1h", "every 6h", "every 12h", "0 */6 * * *", "0 0 * * *"].map((c) => (
                <button key={c} onClick={() => setCronExpr(c)} className={`px-3 py-2 rounded-lg text-xs font-mono transition-all ${cronExpr === c ? "bg-brand-500/20 border border-brand-500/40 text-brand-300" : "bg-surface-800 border border-slate-700/30 text-slate-400 hover:border-slate-500/50"}`}>{c}</button>
              ))}
            </div>
            <input className="glass-input font-mono text-sm" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="Or custom cron expression…" />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep("split")}>← Back</button>
              <button className="btn-primary flex-1" onClick={deploy} disabled={deploying}>
                {deploying ? "Deploying…" : "⚡ Deploy Pipeline"}
              </button>
            </div>
          </div>
        </div>

        {/* Done */}
        {step === "done" && (
          <div className="glass-card p-8 text-center space-y-5">
            <div className="text-5xl">{deployResult?.ok ? "✅" : "❌"}</div>
            <h2 className="text-2xl font-bold text-white">
              {deployResult?.ok ? "Pipeline Live" : "Deploy Failed"}
            </h2>
            <p className="text-slate-400 text-sm">
              <code className="text-brand-300">{sourceMint.slice(0, 10)}…</code> → {rules.filter(r => r.pct > 0).length} rules → {cronExpr}
            </p>

            {deployResult?.message && (
              <div className={`p-3 rounded-xl text-sm ${deployResult.ok ? "bg-emerald-500/5 border border-emerald-500/20 text-emerald-300" : "bg-rose-500/5 border border-rose-500/20 text-rose-300"}`}>
                {deployResult.message}
              </div>
            )}

            {deployResult?.ok && (
              <div className="p-4 rounded-xl bg-surface-800/60 border border-slate-700/30 text-xs text-slate-400 text-left space-y-2">
                <div className="flex justify-between">
                  <span>Keypair</span>
                  <span className={deployResult.files?.includes("creator-keypair.json") ? "text-emerald-300" : creatorKeypair && deployResult.downloaded ? "text-amber-300" : creatorKeypair ? "text-amber-300" : "text-rose-300"}>
                    {deployResult.files?.includes("creator-keypair.json") ? "✓ Saved to ~/.hermes/scripts/ — ready to execute" :
                     deployResult.downloaded ? "✓ Downloaded — move to ~/.hermes/scripts/" :
                     creatorKeypair ? "✓ Provided" : "✗ Missing — paste above"}
                  </span>
                </div>
                <div className="flex justify-between"><span>Rules</span><span className="text-white">{rules.filter(r => r.pct > 0).length}</span></div>
                <div className="flex justify-between"><span>Schedule</span><span className="text-emerald-300 font-mono">{cronExpr}</span></div>
                {deployResult.files?.includes("creator-keypair.json") && (
                  <p className="text-[10px] text-emerald-400 pt-1">Zero helpers. Pipeline executes on next cron tick.</p>
                )}
                {!deployResult.files?.includes("creator-keypair.json") && (
                  <p className="text-[10px] text-slate-500 pt-2">
                    {deployResult.downloaded
                      ? "Move downloaded file to ~/.hermes/scripts/creator-keypair.json — the cron poller auto-detects it."
                      : "Run locally (npm run dev) for zero-step deployment — files auto-saved."}
                  </p>
                )}
              </div>
            )}

            <button className="btn-secondary" onClick={resetAll}>← Start New</button>
          </div>
        )}
      </section>
    </main>
  );
}
