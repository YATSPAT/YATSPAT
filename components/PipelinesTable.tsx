import { useEffect, useState } from "react";

interface PublicRule {
  type: string;
  pct: number;
}
interface PublicPipeline {
  id: string;
  wallet: string | null;
  source: string | null;
  targetTokens: string[];
  rules: PublicRule[];
  intervalMinutes: number;
  lastRunStatus: string | null;
  lastRunSummary: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  "buy-burn": "Buy & burn",
  burn: "Burn",
  distribute: "Airdrop",
  send: "Send",
};

function shortMint(m: string): string {
  return m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : m;
}
function fmtInterval(min: number): string {
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min}m`;
}

type Tab = "all" | "live" | "pending";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "all pipes" },
  { key: "live", label: "live" },
  { key: "pending", label: "new" },
];

function StatusBadge({ status }: { status: string | null }) {
  const map =
    status === "success"
      ? { cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", label: "live" }
      : status === "error"
      ? { cls: "bg-rose-500/15 border-rose-500/30 text-rose-300", dot: "bg-rose-400", label: "attention" }
      : { cls: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300", dot: "bg-cyan-400", label: "new" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${map.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot} animate-pulse`} />
      {map.label}
    </span>
  );
}

export default function PipelinesTable() {
  const [pipes, setPipes] = useState<PublicPipeline[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/pipelines-public");
        const data = await res.json();
        if (alive && data.ok) setPipes(data.pipelines || []);
      } catch {
        /* keep last known */
      } finally {
        if (alive) setLoaded(true);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const running = pipes.filter((p) => p.lastRunStatus === "success").length;
  const targets = new Set(pipes.flatMap((p) => p.targetTokens)).size;

  const filtered = pipes.filter((p) => {
    if (tab === "live") return p.lastRunStatus === "success";
    if (tab === "pending") return !p.lastRunStatus;
    return true; // "all"
  });

  return (
    <div className="space-y-5">
      {/* Stats row (perpad "positions" stats analog) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "pipes running", value: String(pipes.length) },
          { label: "airdropping now", value: String(running) },
          { label: "target tokens", value: String(targets) },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-2xl font-bold text-white font-mono">{s.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/[0.05]">
                <th className="px-4 py-3 font-medium">Pipe</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Targets</th>
                <th className="px-4 py-3 font-medium">Every</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-xs">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <div className="text-2xl mb-2 opacity-60">🪄</div>
                  <p className="text-xs text-slate-400 font-medium">No pipes here yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">Build the first one below.</p>
                </td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{p.wallet ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.rules.map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-surface-900/70 border border-white/[0.05] text-[11px] text-slate-300">
                            {ACTION_LABEL[r.type] ?? r.type} {r.pct}%
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.targetTokens.length ? (
                          p.targetTokens.map((t) => (
                            <a key={t} href={`https://solscan.io/token/${t}`} target="_blank" rel="noopener noreferrer" className="px-1.5 py-0.5 rounded-md bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 font-mono text-[11px] hover:bg-fuchsia-500/25 transition">
                              {shortMint(t)}
                            </a>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{fmtInterval(p.intervalMinutes)}</td>
                    <td className="px-4 py-3 text-right"><StatusBadge status={p.lastRunStatus} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
