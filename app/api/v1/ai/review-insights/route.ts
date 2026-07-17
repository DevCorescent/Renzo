import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseJsonLoose, requireAiEnabled, runAi } from "@/lib/ai/helpers";
import { GROQ_MODELS } from "@/lib/ai/groq";

// POST /api/v1/ai/review-insights — SUPER_ADMIN / OWNER / BRANCH_ADMIN
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const unavailable = requireAiEnabled();
  if (unavailable) return unavailable;

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number; branchId?: string };
    const limit = Math.min(40, Math.max(5, Number(body.limit) || 20));

    const branchFilter =
      user.userType === "BRANCH_ADMIN" && user.branchId
        ? user.branchId
        : body.branchId?.trim() || undefined;

    const reviews = await prisma.review.findMany({
      where: {
        status: "PENDING",
        ...(branchFilter ? { branchId: branchFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        overallRating: true,
        serviceRating: true,
        workerRating: true,
        branchRating: true,
        cleanliness: true,
        punctuality: true,
        comment: true,
        createdAt: true,
        branch: { select: { name: true } },
        worker: { select: { firstName: true, lastName: true, displayName: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    if (reviews.length === 0) {
      return ok({
        summary: "No pending reviews to analyze.",
        themes: [] as string[],
        sentiment: "neutral",
        actionItems: [] as string[],
        count: 0,
      });
    }

    const lines = reviews.map((r, i) => {
      const worker = r.worker
        ? r.worker.displayName?.trim() || `${r.worker.firstName} ${r.worker.lastName}`
        : "unassigned";
      return `${i + 1}. ${r.overallRating}/5 @ ${r.branch.name} / ${worker} — "${(r.comment ?? "").slice(0, 200)}" (clean:${r.cleanliness ?? "-"} punct:${r.punctuality ?? "-"})`;
    });

    const result = await runAi(
      [
        {
          role: "system",
          content: `You summarize pending salon reviews for Renzo managers.
Return JSON: { "summary": string, "themes": string[], "sentiment": "positive"|"mixed"|"negative"|"neutral", "actionItems": string[] }
Be concise and actionable.`,
        },
        {
          role: "user",
          content: `Pending reviews (${reviews.length}):\n${lines.join("\n")}`,
        },
      ],
      { model: GROQ_MODELS.default, temperature: 0.3, maxTokens: 800, json: true }
    );

    if (!result.ok) return err(result.error, result.status);

    const parsed = parseJsonLoose<{
      summary?: string;
      themes?: string[];
      sentiment?: string;
      actionItems?: string[];
    }>(result.content);

    return ok({
      summary: parsed?.summary ?? result.content,
      themes: parsed?.themes ?? [],
      sentiment: parsed?.sentiment ?? "mixed",
      actionItems: parsed?.actionItems ?? [],
      count: reviews.length,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
