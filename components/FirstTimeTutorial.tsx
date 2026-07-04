import { useCallback, useEffect, useState } from "react";

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="brand"]',
    title: "Welcome to Wen Stimmy",
    body: "Turn your Pump.fun creator fees into automatic holder growth — airdrops, buybacks, or straight transfers. No manual claiming, no custody of your keys.",
  },
  {
    selector: '[data-tour="wallet-hud"]',
    title: "Non-custodial by design",
    body: "Creating a pipeline generates a fresh wallet just for it. You set that wallet as your token's sole Pump.fun fee receiver — your own private key never touches this app.",
  },
  {
    selector: '[data-tour="rule-builder"]',
    title: "Build your rules",
    body: "Pick what happens to collected fees: Airdrop to holders, Buy back & burn, or Send to a wallet. Add as many rules as you like — their percentages must add up to 100%.",
  },
  {
    selector: '[data-tour="holder-modes"]',
    title: "Choose your reach",
    body: "Airdrop rules have three reach modes — Bless (10 lucky holders, big drops each), @Here (a thicker spread), or Spam (max holders per buy). The per-holder payout estimate updates live under the drop threshold below.",
  },
  {
    selector: '[data-tour="drop-threshold"]',
    title: "Set a drop threshold",
    body: "Fees accumulate until spendable SOL clears this amount, then a round fires. Checking itself is adaptive — every 1 to 60 minutes, speeding up while fees keep flowing in and slowing down once they dry up.",
  },
  {
    selector: '[data-tour="validate-button"]',
    title: "Validate, then commit",
    body: "Press VALIDATE to see the exact workflow before creating anything. This matters: once created there's no edit screen, so validating is your one real chance to catch a mistake.",
  },
  {
    selector: '[data-tour="create-button"]',
    title: "Activate on Pump.fun",
    body: "After creating, set the generated wallet as your token's fee receiver on Pump.fun, then hit Activate. Once verified on-chain, fees start flowing automatically.",
  },
];

const HOLE_PAD = 8;
const MIN_TOOLTIP_SPACE = 170;
const TOOLTIP_W = 340;

interface Hole {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/* First-run walkthrough — a spotlight mask (not a modal): the whole page dims except a cutout
   around the real element each step describes, with a callout beside it. Shown once
   automatically (see the localStorage gate in pages/index.tsx), reopenable any time via the
   header's "?" button. */
export default function FirstTimeTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector(STEPS[step].selector);
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setHole({
      top: Math.max(0, r.top - HOLE_PAD),
      left: Math.max(0, r.left - HOLE_PAD),
      right: Math.min(window.innerWidth, r.right + HOLE_PAD),
      bottom: Math.min(window.innerHeight, r.bottom + HOLE_PAD),
    });
  }, [step]);

  useEffect(() => {
    if (!open) return;
    measure();
    document.querySelector(STEPS[step].selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Smooth scrolling fires many scroll events — keep re-measuring so the cutout tracks the
    // target the whole way, not just before/after the animation.
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, step, measure]);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => {
    setStep(0);
    setHole(null);
    onClose();
  };
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const placeBelow = !hole || vh - hole.bottom >= MIN_TOOLTIP_SPACE || vh - hole.bottom >= hole.top;
  const tooltipLeft = hole
    ? Math.min(Math.max(hole.left, 16), Math.max(16, vw - TOOLTIP_W - 16))
    : Math.max(16, vw / 2 - TOOLTIP_W / 2);
  const tooltipStyle = hole
    ? placeBelow
      ? { top: hole.bottom + 16, left: tooltipLeft }
      : { bottom: vh - hole.top + 16, left: tooltipLeft }
    : { top: "50%", left: tooltipLeft, transform: "translateY(-50%)" };

  return (
    <>
      {hole ? (
        <>
          {/* Four bars dim everything outside the cutout; the hole itself is left uncovered so
              the highlighted element stays visible and interactive. */}
          <div className="fixed bg-black/75 z-[90]" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className="fixed bg-black/75 z-[90]" style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-black/75 z-[90]" style={{ top: hole.top, left: 0, width: hole.left, height: hole.bottom - hole.top }} />
          <div className="fixed bg-black/75 z-[90]" style={{ top: hole.top, left: hole.right, right: 0, height: hole.bottom - hole.top }} />
          <div
            className="fixed pointer-events-none z-[90] border-2 border-pink-400 shadow-[0_0_0_4px_rgba(236,72,153,0.15),0_0_24px_2px_rgba(236,72,153,0.6)]"
            style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/75 z-[90]" />
      )}

      <div className="fixed z-[91]" style={{ ...tooltipStyle, width: `min(${TOOLTIP_W}px, calc(100vw - 2rem))` }}>
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-pink-300 font-bold">
              Step {step + 1} of {STEPS.length}
            </span>
            <button onClick={finish} aria-label="Close tutorial" className="dazzle-close">
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-white mb-1.5">{current.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{current.body}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 ${i === step ? "bg-pink-400" : "bg-white/15"}`} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button type="button" onClick={back} className="btn-secondary flex-1 text-sm">
                Back
              </button>
            )}
            {!isLast ? (
              <button type="button" onClick={next} className="btn-primary flex-1 text-sm">
                Next
              </button>
            ) : (
              <button type="button" onClick={finish} className="btn-deploy flex-1 text-sm">
                Let's go
              </button>
            )}
          </div>

          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </>
  );
}
