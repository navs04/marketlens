import { env } from "../config/env.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Cheap and fast: this is templated explanation of pre-computed numbers, not
// open-ended reasoning, so the smallest current model is the right tradeoff.
// Configurable (ANTHROPIC_MODEL) so a model change never needs a code change.
const MODEL = env.ANTHROPIC_MODEL;

let usage = { day: "", count: 0 };

/** True (and counts the call) while today's LLM budget has room. */
function reserveCall(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) usage = { day: today, count: 0 };
  if (usage.count >= env.LLM_DAILY_CALL_LIMIT) return false;
  usage.count += 1;
  return true;
}

/**
 * Calls the LLM with a system prompt and a single user message. Returns
 * the generated text, or null if no API key is configured or the call
 * fails for any reason (network error, rate limit, malformed response).
 * Never throws - the explanation service always has a deterministic
 * fallback to use instead, and a flaky LLM call must never break the
 * dashboard.
 */
export async function generateText(systemPrompt: string, userMessage: string): Promise<string | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!reserveCall()) return null; // over today's cap: caller serves the deterministic explanation

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.error(`LLM call failed: HTTP ${response.status} ${await response.text().catch(() => "")}`);
      return null;
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();

    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error("LLM call crashed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export const LLM_MODEL_NAME = MODEL;
