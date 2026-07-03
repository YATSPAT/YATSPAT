import type { NextApiRequest, NextApiResponse } from "next";
import { chatComplete, type ChatMessage } from "../../lib/openrouter";

/* ── POST /api/chat ──────────────────────────────────────────────────
   Conversational front-end for deploying an ATA growth pipeline. The
   model NEVER sees the operations wallet keypair — that's collected via
   a dedicated field in the UI and sent straight to /api/deploy. This
   endpoint only extracts non-secret configuration (source, rules,
   schedule) into a structured draft the client accumulates turn by turn. */

const RULE_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["burn", "buy-burn", "distribute", "send"] },
    pct: { type: "number", description: "0-100, share of the collected pool this rule receives" },
    targetMint: { type: "string", description: "SPL mint to swap into / distribute / send (not needed for burn)" },
    targetWallet: { type: "string", description: "destination wallet, only for type=send" },
    holderMint: { type: "string", description: "token whose holders enter the lottery, only for type=distribute" },
  },
  required: ["type", "pct"],
};

const UPDATE_DRAFT_TOOL = {
  type: "function",
  function: {
    name: "update_draft",
    description:
      "Record what you've learned about the user's pipeline configuration so far. Call this on every turn, filling in only fields you are confident about. Omit fields you don't know yet — never guess or invent values.",
    parameters: {
      type: "object",
      properties: {
        claimCreatorFees: {
          type: "boolean",
          description: "true if the SOL source is collected Pump.fun creator rewards (the common case); false if the source is an SPL token this wallet already holds",
        },
        sourceMint: { type: "string", description: "SPL mint address, only when claimCreatorFees is false" },
        sourceWallet: { type: "string", description: "the Solana wallet address that funds/executes this job" },
        rules: { type: "array", items: RULE_SCHEMA, description: "full replacement list of growth rules; percentages must sum to 100" },
        intervalMinutes: { type: "number", description: "how often (minutes) the job checks for collectible SOL: 5, 15, 30, 60, 360, 720, or 1440" },
        dropThresholdSol: { type: "number", description: "spendable SOL required before a distribution round fires; default 0.5 if unmentioned" },
        readyToDeploy: {
          type: "boolean",
          description: "true ONLY once the user has explicitly confirmed the full configuration and wants to deploy now",
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are the setup assistant for "Wen Stimmy" — a panel that automatically collects Pump.fun creator fees (paid in SOL) and uses them to grow a token's on-chain holder count (ATA growth), or performs other treasury actions (burn, swap-and-burn, send).

Walk the user conversationally through configuring a pipeline:
1. Funding source — almost always "collect Pump.fun creator rewards" (claimCreatorFees=true). Get the wallet address that owns those rewards.
2. Growth rules — how the collected SOL is split. Default recommendation for a single rule: 100% "distribute" (increase ATA holders) using the project's own token as both target and holder-snapshot mint. Support multiple rules if the user wants a split (e.g. 50% distribute, 50% swap-and-burn). Percentages must total 100.
3. Schedule — how often to check (default: every hour) and the SOL drop threshold before a distribution round fires (default: 0.5 SOL, supports up to ~245 recipients).

Do NOT ask for or discuss a private key / keypair — that is collected separately by the UI, never through chat.

After every response, call update_draft with whatever fields you're now confident about (partial updates are fine — omit what's still unknown). Ask one focused question at a time. Once source, at least one rule (summing to 100%), and a schedule are known, summarize the full configuration and ask the user to confirm before setting readyToDeploy=true. Keep responses short — 2-3 sentences plus your question.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { messages, draft } = req.body as { messages: ChatMessage[]; draft: Record<string, unknown> };
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "messages required" });
  }

  try {
    const withSystem: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrent known draft (JSON, may be partial): ${JSON.stringify(draft || {})}` },
      ...messages,
    ];

    const result = await chatComplete(withSystem, [UPDATE_DRAFT_TOOL]);

    let draftPatch: Record<string, unknown> = {};
    const call = result.toolCalls.find((c) => c.function.name === "update_draft");
    if (call) {
      try {
        draftPatch = JSON.parse(call.function.arguments);
      } catch {
        draftPatch = {};
      }
    }

    return res.json({
      reply: result.content || "Got it.",
      draftPatch,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
