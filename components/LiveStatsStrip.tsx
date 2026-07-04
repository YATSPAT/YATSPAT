import { useEffect, useState } from "react";

interface PublicPipeline {
  totalOutSol?: number;
  lastRunStatus: string | null;
  lastRunAt: string | null;
  targetTokens: string[];
}

function fmtSol(n: number): string {
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(3);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* Static, non-scrolling replacement for the old promo marquee — real platform numbers
   instead of a ticker, pulled from the same public endpoint the Live Pipes section uses. */
export default function LiveStatsStrip() {
  const [pipes, setPipes] = useState<PublicPipeline[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const totalSol = pipes.reduce((sum, p) => sum + (p.totalOutSol ?? 0), 0);
  const targets = new Set(pipes.flatMap((p) => p.targetTokens)).size;
  const lastPayoutAt =
    pipes
      .filter((p) => p.lastRunStatus === "success" && p.lastRunAt)
      .map((p) => p.lastRunAt as string)
      .sort()
      .pop() || null;

  const stats = [
    { value: loaded ? `◎ ${fmtSol(totalSol)}` : "—", label: "SOL sent out" },
    { value: loaded ? String(pipes.length) : "—", label: "pipes running" },
    { value: loaded ? String(targets) : "—", label: "tokens growing" },
    { value: loaded ? timeAgo(lastPayoutAt) : "—", label: "last payout" },
  ];

  return (
    <div className="w-full border-y-2 border-cyan-400/40 bg-[#0a1220] shadow-[inset_0_1px_0_0_rgba(34,211,238,0.15),inset_0_-1px_0_0_rgba(34,211,238,0.15)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-center gap-y-2">
        <span className="flex items-center gap-1.5 pr-4 sm:pr-6 mr-4 sm:mr-6 border-r border-cyan-400/20">
          <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Live</span>
        </span>
        {stats.map((s, i) => (
          <span
            key={s.label}
            className={`flex items-baseline gap-2 pr-4 sm:pr-6 mr-4 sm:mr-6 last:mr-0 last:pr-0 last:border-r-0 border-r border-cyan-400/20`}
          >
            <span className="text-sm sm:text-base font-bold text-cyan-200 font-mono [text-shadow:0_0_10px_rgba(34,211,238,0.35)]">{s.value}</span>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
