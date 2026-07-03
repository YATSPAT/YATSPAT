const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen-2.5-72b-instruct";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatCompletionResult {
  content: string;
  toolCalls: ToolCall[];
}

/* ── OpenRouter chat completion, OpenAI-compatible wire format ──
   Model is Qwen 2.5 by default — a capable open model at a fraction of the cost
   of a frontier model, which is the right tier for structured-field extraction
   in a conversational wizard (not open-ended reasoning). */
export async function chatComplete(
  messages: ChatMessage[],
  tools?: object[]
): Promise<ChatCompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://panel.wenstimmy.fun",
      "X-Title": "Wen Stimmy ATA Growth Panel",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${msg.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  if (!choice) throw new Error("OpenRouter returned no choices");

  return {
    content: choice.content || "",
    toolCalls: choice.tool_calls || [],
  };
}
