import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { parseJsonLoose, requireAiEnabled, runAi } from "@/lib/ai/helpers";
import { GROQ_MODELS } from "@/lib/ai/groq";

const KINDS = new Set(["banner", "blog", "offer"]);

// POST /api/v1/ai/cms-copy — SUPER_ADMIN / OWNER / MARKETING_MANAGER
// Body: { topic: string; tone?: string; kind: "banner" | "blog" | "offer" }
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  const unavailable = requireAiEnabled();
  if (unavailable) return unavailable;

  try {
    const body = (await req.json().catch(() => null)) as {
      topic?: string;
      tone?: string;
      kind?: string;
    } | null;

    const topic = body?.topic?.trim();
    const kind = body?.kind?.trim()?.toLowerCase();
    const tone = body?.tone?.trim() || "premium and welcoming";

    if (!topic) return err("topic is required", 400);
    if (!kind || !KINDS.has(kind)) {
      return err("kind must be one of: banner, blog, offer", 400);
    }

    const kindHints: Record<string, string> = {
      banner: "Short hero banner: punchy title (≤8 words) and 1–2 sentence body. Optional CTA line.",
      blog: "Blog-style: engaging title and 2–4 short paragraphs of body copy about salon topics.",
      offer: "Promo offer: catchy title and persuasive body with soft urgency, no fake discounts.",
    };

    const result = await runAi(
      [
        {
          role: "system",
          content: `You write marketing copy for Renzo Hair & Beauty Studio (premium Indian salon brand).
Return JSON: { "title": string, "body": string, "cta"?: string }
${kindHints[kind]}
Tone: ${tone}. No emojis. No invented prices unless the topic includes them.`,
        },
        {
          role: "user",
          content: `Kind: ${kind}\nTopic: ${topic}`,
        },
      ],
      { model: GROQ_MODELS.default, temperature: 0.7, maxTokens: 900, json: true }
    );

    if (!result.ok) return err(result.error, result.status);

    const parsed = parseJsonLoose<{ title?: string; body?: string; cta?: string }>(result.content);

    return ok({
      title: parsed?.title ?? "Renzo",
      body: parsed?.body ?? result.content,
      cta: parsed?.cta,
      kind,
      tone,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
