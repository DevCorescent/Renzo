import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

type SkillInput = string | { skillId: string; proficiency?: number };

// OWNER: Aman | MODULE: Worker Skills
// GET /api/v1/admin/workers/[id]/skills — List worker skills
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const skills = await prisma.workerSkill.findMany({
      where: { workerId: id },
      include: { skill: true },
    });
    return ok(skills);
  } catch {
    return err("Internal server error", 500);
  }
}

// PUT /api/v1/admin/workers/[id]/skills — Replace all worker skills
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    const raw: SkillInput[] = Array.isArray(body) ? body : body.skills;
    if (!Array.isArray(raw)) {
      return err("Expected an array of skills (skill IDs or {skillId, proficiency})", 422);
    }

    // Normalize to { skillId, proficiency }.
    const entries = raw.map((s) =>
      typeof s === "string"
        ? { skillId: s, proficiency: 3 }
        : { skillId: s.skillId, proficiency: s.proficiency ?? 3 }
    );
    if (entries.some((e) => !e.skillId)) {
      return err("Every skill entry needs a skillId", 422);
    }

    const worker = await prisma.workerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!worker) return err("Worker not found", 404);

    // Replace-all semantics: clear then re-insert in one transaction.
    await prisma.$transaction([
      prisma.workerSkill.deleteMany({ where: { workerId: id } }),
      prisma.workerSkill.createMany({
        data: entries.map((e) => ({
          workerId: id,
          skillId: e.skillId,
          proficiency: e.proficiency,
        })),
        skipDuplicates: true,
      }),
    ]);

    const skills = await prisma.workerSkill.findMany({
      where: { workerId: id },
      include: { skill: true },
    });
    return ok(skills, "Skills updated");
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2003") {
      return err("One or more skillId values do not exist", 422);
    }
    return err("Internal server error", 500);
  }
}
