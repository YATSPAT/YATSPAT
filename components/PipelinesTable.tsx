import React, { useEffect, useRef, useState } from "react";

interface PublicRule {
  type: string;
  pct: number;
}
interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
}
interface PublicPipeline {
  id: string;
  wallet: string | null;
  source: string | null;
  feeMint?: string | null;
  primaryMint?: string | null;
  token?: TokenInfo | null;
  targetTokens: string[];
  rules: PublicRule[];
  intervalMinutes: number;
  totalOutSol?: number;
  lastRunStatus: string | null;
  lastRunSummary: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

function shortMint(m: string): string {
  return m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : m;
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
      ? { cls: "bg-brand-500/15 border-brand-500/30 text-brand-300", dot: "bg-brand-400", label: "live" }
      : status === "error"
      ? { cls: "bg-brand-600/15 border-brand-600/30 text-brand-600", dot: "bg-brand-600", label: "attention" }
      : { cls: "bg-brand-500/15 border-brand-400/30 text-brand-300", dot: "bg-brand-400", label: "new" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none border text-[10px] font-medium ${map.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-none ${map.dot} animate-pulse`} aria-hidden="true" />
      {map.label}
    </span>
  );
}

function fmtSol(n: number): string {
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(3);
}

/* A pipeline's token as a card for the carousel — ticker, image, SOL sent out. */
function TokenCard({ p }: { p: PublicPipeline }) {
  const [imgErr, setImgErr] = useState(false);
  const t = p.token;
  const mint = t?.mint || p.primaryMint || "";
  const ticker = t?.symbol ? `$${t.symbol}` : mint ? shortMint(mint) : "—";
  const initial = ((t?.symbol || mint || "?").trim()[0] || "?").toUpperCase();
  const showImg = t?.image && !imgErr;
  const outSol = p.totalOutSol ?? 0;

  return (
    <a
      href={mint ? `https://pump.fun/coin/${mint}` : "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-48 shrink-0 snap-start glass-card p-4 hover:brightness-110 transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t!.image as string}
            alt={ticker}
            onError={() => setImgErr(true)}
            className="w-11 h-11 rounded-none object-cover border border-brand-800 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-none bg-brand-900/40 border border-brand-800 flex items-center justify-center text-base font-bold text-brand-300 shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-brand-300 truncate">{ticker}</div>
          <StatusBadge status={p.lastRunStatus} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-brand-900">
        <div className="text-[10px] uppercase tracking-wider text-brand-700">SOL sent out</div>
        <div className="text-lg font-bold text-brand-300 font-mono leading-tight">◎ {fmtSol(outSol)}</div>
      </div>
    </a>
  );
}

export default function PipelinesTable() {
  const [pipes, setPipes] = useState<PublicPipeline[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const tabListRef = useRef<HTMLDivElement>(null);

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
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "pipes running", value: String(pipes.length) },
          { label: "airdropping now", value: String(running) },
          { label: "target tokens", value: String(targets) },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-2xl font-bold text-brand-300 font-mono">{s.value}</div>
            <div className="text-[11px] text-brand-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Pipeline filters"
        className="flex items-center gap-1.5 overflow-x-auto"
        onKeyDown={(e: React.KeyboardEvent) => {
          const idx = TABS.findIndex((t) => t.key === tab);
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const next = TABS[(idx + 1) % TABS.length];
            setTab(next.key);
            setTimeout(() => (tabListRef.current?.querySelector(`[id="tab-${next.key}"]`) as HTMLElement)?.focus(), 0);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
            setTab(prev.key);
            setTimeout(() => (tabListRef.current?.querySelector(`[id="tab-${prev.key}"]`) as HTMLElement)?.focus(), 0);
          }
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls="pipeline-panel"
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-none text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 ${
              tab === t.key ? "bg-brand-500/20 border border-brand-400/40 text-brand-200" : "text-brand-600 hover:text-brand-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Carousel — one token card per pipe */}
      <div id="pipeline-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {!loaded ? (
          <div className="glass-card py-10 text-center text-brand-700 text-xs">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <div className="text-lg mb-2 opacity-60 tracking-widest">[ EMPTY ]</div>
            <p className="text-xs text-brand-600 font-medium">No pipes here yet</p>
            <p className="text-[11px] text-brand-700 mt-1">Build the first one below.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
            {filtered.map((p) => (
              <TokenCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
