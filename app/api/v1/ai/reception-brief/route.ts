import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseJsonLoose, requireAiEnabled, runAi } from "@/lib/ai/helpers";
import { GROQ_MODELS } from "@/lib/ai/groq";

// POST /api/v1/ai/reception-brief — reception / branch staff
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "OWNER",
    "SUPER_ADMIN"
  );
  if (error) return error;

  const unavailable = requireAiEnabled();
  if (unavailable) return unavailable;

  try {
    const body = (await req.json().catch(() => ({}))) as { branchId?: string };

    const branchId =
      user.branchId ||
      (user.userType === "SUPER_ADMIN" || user.userType === "OWNER"
        ? body.branchId?.trim()
        : undefined);

    if (!branchId) {
      return err("branchId is required for this role", 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [branch, appointments] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
      prisma.appointment.findMany({
        where: {
          branchId,
          appointmentDate: { gte: today, lt: tomorrow },
          status: { notIn: ["CANCELLED"] },
        },
        orderBy: { startTime: "asc" },
        take: 60,
        select: {
          appointmentNo: true,
          startTime: true,
          endTime: true,
          status: true,
          notes: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          worker: { select: { firstName: true, lastName: true, displayName: true } },
          services: { select: { service: { select: { name: true } } } },
        },
      }),
    ]);

    if (!branch) return err("Branch not found", 404);

    const lines = appointments.map((a) => {
      const customer = `${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim();
      const worker = a.worker
        ? a.worker.displayName?.trim() || `${a.worker.firstName} ${a.worker.lastName}`
        : "unassigned";
      const services = a.services.map((s) => s.service.name).join(", ") || "—";
      return `${a.startTime}-${a.endTime} [${a.status}] ${a.appointmentNo}: ${customer} → ${services} w/ ${worker}${a.notes ? ` note:${a.notes.slice(0, 60)}` : ""}`;
    });

    const result = await runAi(
      [
        {
          role: "system",
          content: `You brief Renzo reception staff for the day.
Return JSON: { "headline": string, "brief": string, "priorities": string[], "risks": string[] }
Keep it scannable for a busy front desk. Mention unassigned bookings and peak clusters if any.`,
        },
        {
          role: "user",
          content: `Branch: ${branch.name}
Date: ${today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Appointments (${appointments.length}):
${lines.length ? lines.join("\n") : "None scheduled."}`,
        },
      ],
      { model: GROQ_MODELS.fast, temperature: 0.4, maxTokens: 700, json: true }
    );

    if (!result.ok) return err(result.error, result.status);

    const parsed = parseJsonLoose<{
      headline?: string;
      brief?: string;
      priorities?: string[];
      risks?: string[];
    }>(result.content);

    return ok({
      headline: parsed?.headline ?? `Today at ${branch.name}`,
      brief: parsed?.brief ?? result.content,
      priorities: parsed?.priorities ?? [],
      risks: parsed?.risks ?? [],
      appointmentCount: appointments.length,
      branchName: branch.name,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
