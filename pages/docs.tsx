import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: "overview", title: "Overview" },
  { id: "whitelabel", title: "Pipeline engine" },
  { id: "non-custodial", title: "Non-custodial by design" },
  { id: "building", title: "Building a pipeline" },
  { id: "reach-modes", title: "Holder reach modes" },
  { id: "threshold", title: "Drop threshold & polling" },
  { id: "validate", title: "Validate & permanence" },
  { id: "activate", title: "Activating on Pump.fun" },
  { id: "fee", title: "Platform fee" },
  { id: "faq", title: "FAQ" },
];

function Toc() {
  return (
    <nav className="space-y-0.5">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="block px-2.5 py-1.5 rounded-none text-xs text-brand-700 hover:text-brand-300 hover:bg-brand-950 transition-colors"
        >
          &gt; {s.title}
        </a>
      ))}
    </nav>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 glass-card p-6 space-y-3">
      <h2 className="text-lg font-bold text-brand-300 tracking-wide">&gt; {title}</h2>
      <div className="text-sm text-brand-500 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Docs() {
  return (
    <>
      <Head>
        <title>Docs — YATSPAT</title>
      </Head>
      <main className="relative min-h-screen bg-surface-950">
        <header className="fixed top-0 inset-x-0 z-50 glass-card rounded-none border-b border-brand-900/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
            <Link href="/" className="text-lg font-bold text-brand-300 tracking-tight">
              yatspat <span className="text-brand-600 font-normal text-sm">/ docs</span>
            </Link>
            <Link href="/#create" className="btn-secondary text-xs !py-1.5 !px-4">
              &lt; Back to app
            </Link>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 pt-28 pb-20">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-300 tracking-tight">How YATSPAT works</h1>
            <p className="mt-2 text-brand-700 text-sm max-w-2xl">
              Yet Another Token Spamming Pump.fun Attention Tool. Everything the platform does, in one place — what
              happens to a token&apos;s creator fees, what you control, and what&apos;s permanent once you commit.
            </p>
          </div>

          <div className="grid lg:grid-cols-[200px_1fr] gap-8 items-start">
            <div className="hidden lg:block sticky top-28 hud-panel !p-3">
              <Toc />
            </div>

            <div className="space-y-5">
              <DocSection id="overview" title="Overview">
                <p>
                  YATSPAT automates Pump.fun creator-fee routing. Instead of manually claiming fees and deciding
                  what to do with them, you set up a <strong className="text-brand-200">pipeline</strong> once: it
                  collects a token&apos;s creator fees on a schedule and automatically splits them across rules you
                  define — airdrop to holders, buy back and burn, or send to a wallet.
                </p>
              </DocSection>

              <DocSection id="whitelabel" title="Pipeline engine">
                <p>
                  YATSPAT is the pipeline engine for Pump.fun creator-fee routing. It keeps the workflow explicit:
                  choose the source token, decide where collected SOL goes, validate the exact rules, then activate
                  the generated receiver wallet.
                </p>
                <p>
                  Sites using YATSPAT can have their own token identity and visual system, but the pipeline behavior
                  described here stays the same.
                </p>
              </DocSection>

              <DocSection id="non-custodial" title="Non-custodial by design">
                <p>
                  Creating a pipeline generates a fresh Solana wallet dedicated to it. You then set that wallet as
                  the token&apos;s <strong className="text-brand-200">sole Pump.fun fee receiver</strong>. Your own
                  private key never touches this app — the platform only ever holds the keypair for the wallet it
                  generated, encrypted at rest, and only that wallet ever collects or spends the fees.
                </p>
                <p>
                  The permissionless <code className="glass-input inline font-mono text-xs px-1.5 py-0.5 w-auto">distributeCreatorFees</code>{" "}
                  crank is what actually pulls fees into the pipeline wallet — anyone can call it, so nothing is
                  waiting on this app being online for fees to be collectible.
                </p>
              </DocSection>

              <DocSection id="building" title="Building a pipeline">
                <p>Every pipeline needs two things: a token, and at least one rule.</p>
                <ul className="list-disc list-inside space-y-1.5 marker:text-brand-400">
                  <li><strong className="text-brand-200">Your token</strong> — the Pump.fun mint whose creator fees this pipeline collects.</li>
                  <li>
                    <strong className="text-brand-200">Rules</strong> — what happens to the collected SOL. Add as
                    many as you like; their percentages must add up to 100%:
                    <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                      <li><strong className="text-brand-300">Airdrop to holders</strong> — swap the SOL into a token and distribute it to holders of another token (or your own).</li>
                      <li><strong className="text-brand-300">Buy back &amp; burn</strong> — swap the SOL into a token and burn it forever.</li>
                      <li><strong className="text-brand-300">Send to a wallet</strong> — route the SOL straight to a wallet you choose.</li>
                    </ul>
                  </li>
                </ul>
              </DocSection>

              <DocSection id="reach-modes" title="Holder reach modes">
                <p>
                  Airdrop rules pick recipients by lottery among a token&apos;s holders, then split the swapped amount{" "}
                  <strong className="text-brand-200">equally</strong> — never weighted by balance. A lower recipient
                  cap means a bigger share each; a higher cap means broader reach. Three modes control that cap:
                </p>
                <div className="grid sm:grid-cols-3 gap-2 pt-1">
                  <div className="glass-input !bg-surface-900/60 space-y-1">
                    <div className="font-bold text-brand-200">[ Bless ]</div>
                    <div className="text-xs text-brand-700">Up to 10 holders — big drops each</div>
                  </div>
                  <div className="glass-input !bg-surface-900/60 space-y-1">
                    <div className="font-bold text-brand-200">[ @Here ]</div>
                    <div className="text-xs text-brand-700">Up to 122 holders — a thicker spread</div>
                  </div>
                  <div className="glass-input !bg-surface-900/60 space-y-1">
                    <div className="font-bold text-brand-200">[ Spam ]</div>
                    <div className="text-xs text-brand-700">Up to 245 holders — max reach per buy</div>
                  </div>
                </div>
                <p className="text-xs text-brand-800">
                  If the pool of SOL ends up bigger than usual (fees piled up over a few cycles), the cap scales up
                  proportionally so the surplus reaches more holders instead of just paying the same audience more.
                </p>
              </DocSection>

              <DocSection id="threshold" title="Drop threshold & adaptive polling">
                <p>
                  Fees accumulate in the pipeline wallet until spendable SOL clears your{" "}
                  <strong className="text-brand-200">drop threshold</strong> (0.5 SOL by default) — then a round
                  fires automatically. The wallet always keeps a small reserve (0.02 SOL) for its own transaction
                  fees, which is never spent by your rules.
                </p>
                <p>
                  Checking for collectible fees is <strong className="text-brand-200">adaptive</strong>, not fixed:
                  it starts at every 5 minutes, then speeds up (down to every minute) while fees keep flowing in, and
                  slows down (up to once an hour) once they dry up — so an active token gets checked often without
                  wasting checks on a quiet one.
                </p>
              </DocSection>

              <DocSection id="validate" title="Validate & permanence">
                <p>
                  Before you can create a pipeline, you must press <strong className="text-brand-200">VALIDATE</strong>.
                  It runs the exact same checks the create step will, plus a live on-chain lookup of every token
                  you&apos;ve referenced, and shows the precise workflow that will be created — fee source, drop
                  threshold, and one plain-English line per rule.
                </p>
                <p className="text-brand-300/90">
                  This matters because pipelines are permanent once created — there is no edit screen. Validating is
                  your one real chance to catch a mistake before it&apos;s locked in.
                </p>
              </DocSection>

              <DocSection id="activate" title="Activating on Pump.fun">
                <p>
                  Creating a pipeline generates its wallet but leaves it paused. Set that wallet as the token&apos;s fee
                  receiver on Pump.fun, then come back and press <strong className="text-brand-200">Activate</strong> —
                  the app verifies on-chain that the wallet is genuinely entitled to the token&apos;s fees before turning
                  the pipeline on. Nothing runs until that check passes.
                </p>
              </DocSection>

              <DocSection id="fee" title="Platform fee">
                <p>
                  A flat 1.5% platform fee is taken off the top of each round before your own rules run. It&apos;s the
                  only cut the app takes — everything else you configure goes exactly where you told it to.
                </p>
              </DocSection>

              <DocSection id="faq" title="FAQ">
                <div className="space-y-4">
                  <div>
                    <p className="text-brand-200 font-semibold">Can I edit a pipeline after creating it?</p>
                    <p>No. There&apos;s no edit endpoint — VALIDATE exists precisely because creation is final.</p>
                  </div>
                  <div>
                    <p className="text-brand-200 font-semibold">Is my own private key ever exposed to this app?</p>
                    <p>No. The app only ever generates and holds its own pipeline wallets, never your personal key.</p>
                  </div>
                  <div>
                    <p className="text-brand-200 font-semibold">How often does it check for fees?</p>
                    <p>Adaptively, between once a minute and once an hour — see &quot;Drop threshold &amp; adaptive polling&quot; above.</p>
                  </div>
                  <div>
                    <p className="text-brand-200 font-semibold">What if I want to stop a pipeline?</p>
                    <p>Reach out — pipelines can be disabled so they stop being checked and never spend again.</p>
                  </div>
                  <div>
                    <p className="text-brand-200 font-semibold">Do other sites use this same pipeline engine?</p>
                    <p>Yes. Sites using YATSPAT can have their own identity, but the fee-routing behavior stays the same.</p>
                  </div>
                </div>
              </DocSection>
            </div>
          </div>
        </div>

        <footer className="relative border-t border-brand-900/60">
          <div className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-brand-800">
            <Link href="/" className="hover:text-brand-400 transition-colors">&lt; Back to the app</Link>
          </div>
        </footer>
      </main>
    </>
  );
}
