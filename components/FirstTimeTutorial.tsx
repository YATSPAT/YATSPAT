import { useState } from "react";

interface TutorialStep {
  title: string;
  body: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Wen Stimmy",
    body: "Turn your Pump.fun creator fees into automatic holder growth — airdrops, buybacks, or straight transfers. No manual claiming, no custody of your keys.",
  },
  {
    title: "Non-custodial by design",
    body: "Creating a pipeline generates a fresh wallet just for it. You set that wallet as your token's sole Pump.fun fee receiver — your own private key never touches this app.",
  },
  {
    title: "Build your rules",
    body: "Pick what happens to collected fees: Airdrop to holders, Buy back & burn, or Send to a wallet. Add as many rules as you like — their percentages must add up to 100%.",
  },
  {
    title: "Choose your reach",
    body: "Airdrop rules have three reach modes — Bless (10 lucky holders, big drops each), @Here (a thicker spread), or Spam (max holders per buy). The per-holder payout estimate updates live as you tune the drop threshold.",
  },
  {
    title: "Set a drop threshold",
    body: "Fees accumulate until spendable SOL clears this amount, then a round fires. Checking itself is adaptive — every 1 to 60 minutes, speeding up while fees keep flowing in and slowing down once they dry up.",
  },
  {
    title: "Validate, then commit",
    body: "Press VALIDATE to see the exact workflow before creating anything. This matters: once created there's no edit screen, so validating is your one real chance to catch a mistake.",
  },
  {
    title: "Activate on Pump.fun",
    body: "After creating, set the generated wallet as your token's fee receiver on Pump.fun, then hit Activate. Once verified on-chain, fees start flowing automatically.",
  },
];

/* First-run walkthrough — shown once automatically (see the localStorage gate in
   pages/index.tsx), and reopenable any time via the header's "?" button. */
export default function FirstTimeTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => {
    setStep(0);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/70" onClick={finish} />
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
        <div className="glass-card w-full max-w-md p-6 space-y-5 pointer-events-auto">
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
            <h3 className="text-lg font-bold text-white mb-2">{current.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{current.body}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 ${i === step ? "bg-pink-400" : "bg-white/15"}`} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary flex-1 text-sm">
                Back
              </button>
            )}
            {!isLast ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary flex-1 text-sm">
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
