import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAiEnabled, runAi } from "@/lib/ai/helpers";
import { GROQ_MODELS, type ChatMessage, type ChatRole } from "@/lib/ai/groq";
import { clientIp, rateLimit } from "@/lib/ai/rate-limit";

const SYSTEM = `You are Renzo's public FAQ assistant for a premium hair & beauty salon in India.
Help guests with: booking online, services (haircut, colour, spa, bridal), stylists, branches, timing, cancellation/reschedule basics, and salon etiquette.
Be warm, concise (2–4 short sentences unless asked for detail). If you don't know branch-specific prices or exact availability, suggest using the Book page or contacting reception.
Never invent discounts, medical advice, or account-specific data. Do not collect passwords or payment card numbers.`;

const ALLOWED_ROLES = new Set<ChatRole>(["user", "assistant"]);

// POST /api/v1/ai/chat — public FAQ chatbot (rate-limited)
// Body: { messages: [{ role: "user"|"assistant", content: string }] }
export async function POST(req: NextRequest) {
  const unavailable = requireAiEnabled();
  if (unavailable) return unavailable;

  const ip = clientIp(req);
  const rl = rateLimit(`ai-chat:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return err(`Too many requests. Try again in ${rl.retryAfterSec}s`, 429);
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      messages?: { role?: string; content?: string }[];
    } | null;

    const incoming = body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return err("messages array is required", 400);
    }

    const cleaned: ChatMessage[] = [];
    for (const m of incoming.slice(-12)) {
      const role = (m.role ?? "").toLowerCase() as ChatRole;
      const content = typeof m.content === "string" ? m.content.trim() : "";
      if (!ALLOWED_ROLES.has(role) || !content || content.length > 2000) continue;
      cleaned.push({ role, content });
    }

    if (cleaned.length === 0) return err("No valid messages", 400);
    if (cleaned[cleaned.length - 1]?.role !== "user") {
      return err("Last message must be from user", 400);
    }

    const result = await runAi(
      [{ role: "system", content: SYSTEM }, ...cleaned],
      { model: GROQ_MODELS.fast, temperature: 0.5, maxTokens: 500 }
    );

    if (!result.ok) return err(result.error, result.status);

    return ok({
      reply: result.content,
      model: result.model,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
