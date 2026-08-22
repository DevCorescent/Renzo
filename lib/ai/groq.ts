// Thin Groq OpenAI-compatible chat client.
// Uses GROQ_API_KEY only — never commit secrets.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq retired the Llama 3.x chat models; `llama-3.3-70b-versatile` and
// `llama-3.1-8b-instant` now answer 404 "model does not exist or you do not
// have access to it", which is what surfaced as the AI stylist tips error.
// Verify against `GET https://api.groq.com/openai/v1/models` before changing
// these — both below are confirmed to support `response_format: json_object`,
// which every caller here relies on.
export const GROQ_MODELS = {
  default: "openai/gpt-oss-120b",
  fast: "openai/gpt-oss-20b",
} as const;

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionOpts = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

export type ChatCompletionSuccess = {
  ok: true;
  content: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
};

export type ChatCompletionError = {
  ok: false;
  error: string;
  status: number;
  code: "MISSING_API_KEY" | "GROQ_ERROR" | "EMPTY_RESPONSE" | "NETWORK_ERROR";
};

export type ChatCompletionResult = ChatCompletionSuccess | ChatCompletionError;

export function isGroqEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key || null;
}

/**
 * Call Groq chat completions. Returns a typed result — never throws for missing key.
 * Pass `throwOnMissingKey: true` to throw instead.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatCompletionOpts & { throwOnMissingKey?: boolean } = {}
): Promise<ChatCompletionResult> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    if (opts.throwOnMissingKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    return {
      ok: false,
      error: "AI is not configured (GROQ_API_KEY missing)",
      status: 503,
      code: "MISSING_API_KEY",
    };
  }

  const model = opts.model ?? GROQ_MODELS.default;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      model?: string;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message ?? `Groq request failed (${res.status})`,
        status: res.status >= 500 ? 502 : res.status,
        code: "GROQ_ERROR",
      };
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        ok: false,
        error: "Empty response from Groq",
        status: 502,
        code: "EMPTY_RESPONSE",
      };
    }

    return {
      ok: true,
      content,
      model: data?.model ?? model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error calling Groq",
      status: 502,
      code: "NETWORK_ERROR",
    };
  }
}
