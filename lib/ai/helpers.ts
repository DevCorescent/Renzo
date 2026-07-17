import { err } from "@/lib/response";
import { chatCompletion, isGroqEnabled, type ChatCompletionResult, type ChatMessage, type ChatCompletionOpts } from "@/lib/ai/groq";

export function aiUnavailable() {
  return err("AI is unavailable — GROQ_API_KEY is not configured", 503);
}

export function requireAiEnabled(): ReturnType<typeof aiUnavailable> | null {
  if (!isGroqEnabled()) return aiUnavailable();
  return null;
}

export async function runAi(
  messages: ChatMessage[],
  opts?: ChatCompletionOpts
): Promise<ChatCompletionResult> {
  return chatCompletion(messages, opts);
}

/** Best-effort JSON parse from model output (strips fences if present). */
export function parseJsonLoose<T = Record<string, unknown>>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
