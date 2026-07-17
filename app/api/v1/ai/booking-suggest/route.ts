import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { getAuthUser } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseJsonLoose, requireAiEnabled, runAi } from "@/lib/ai/helpers";
import { GROQ_MODELS } from "@/lib/ai/groq";

// POST /api/v1/ai/booking-suggest — public (auth optional)
// Body: { serviceName: string; preferences?: string; branchId?: string }
export async function POST(req: NextRequest) {
  const unavailable = requireAiEnabled();
  if (unavailable) return unavailable;

  try {
    const body = (await req.json().catch(() => null)) as {
      serviceName?: string;
      preferences?: string;
      branchId?: string;
    } | null;

    const serviceName = body?.serviceName?.trim();
    if (!serviceName) return err("serviceName is required", 400);

    const preferences = body?.preferences?.trim();
    const branchId = body?.branchId?.trim();

    // Optional context — auth is not required but branch-scoped workers help.
    await getAuthUser(req);

    const workers = await prisma.workerProfile.findMany({
      where: {
        isActive: true,
        isPublic: true,
        ...(branchId
          ? { branches: { some: { branchId, isActive: true } } }
          : {}),
        services: {
          some: {
            isActive: true,
            service: { name: { contains: serviceName, mode: "insensitive" } },
          },
        },
      },
      take: 8,
      select: {
        displayName: true,
        firstName: true,
        lastName: true,
        experience: true,
        bio: true,
        languages: true,
        designation: { select: { name: true } },
        skills: { select: { skill: { select: { name: true } }, proficiency: true }, take: 5 },
      },
    });

    const workerContext = workers.length
      ? workers
          .map((w) => {
            const name = w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
            const skills = w.skills.map((s) => `${s.skill.name}(${s.proficiency})`).join(", ");
            return `- ${name}: ${w.experience}y exp, ${w.designation?.name ?? "stylist"}, languages: ${w.languages.join("/") || "—"}, skills: ${skills || "—"}, bio: ${(w.bio ?? "").slice(0, 120)}`;
          })
          .join("\n")
      : "No matching public stylists found in database.";

    const result = await runAi(
      [
        {
          role: "system",
          content: `You are Renzo salon booking assistant. Suggest helpful stylist tips and short booking messaging for customers.
Return JSON: { "tips": string[], "messaging": string, "suggestedFocus": string }
Keep tips to 3-5 short bullets. Tone: warm, premium, concise. No medical claims.`,
        },
        {
          role: "user",
          content: `Service: ${serviceName}
Preferences: ${preferences || "none"}
Available stylists context:
${workerContext}`,
        },
      ],
      { model: GROQ_MODELS.fast, temperature: 0.5, maxTokens: 600, json: true }
    );

    if (!result.ok) return err(result.error, result.status);

    const parsed = parseJsonLoose<{
      tips?: string[];
      messaging?: string;
      suggestedFocus?: string;
    }>(result.content);

    return ok({
      tips: parsed?.tips ?? [result.content],
      messaging: parsed?.messaging ?? result.content,
      suggestedFocus: parsed?.suggestedFocus ?? serviceName,
      workersConsidered: workers.length,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
