// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Skills
// ROUTE  : /api/v1/admin/workers/[id]/skills
//
// METHODS
// GET    - List worker skills
// PUT    - Replace worker skills
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PUT    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

// WorkerSkill.proficiency is a 1–5 competency band. It defaults to 3 so an
// assignment made by id alone lands mid-scale rather than at the bottom.
const MIN_PROFICIENCY = 1;
const MAX_PROFICIENCY = 5;
const DEFAULT_PROFICIENCY = 3;

/**
 * The shape both methods return, so a PUT response is byte-identical to a
 * subsequent GET — the client never has to reconcile two views of the same list.
 */
const WORKER_SKILL_SELECT = {
  id: true,
  proficiency: true,
  skill: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
} satisfies Prisma.WorkerSkillSelect;

/**
 * Ordered by skill name, with the join-row id as a tiebreaker: Skill.name is
 * unique today, but relying on that to keep the order deterministic would couple
 * this listing to a constraint it does not own.
 */
const WORKER_SKILL_ORDER: Prisma.WorkerSkillOrderByWithRelationInput[] = [
  { skill: { name: "asc" } },
  { id: "asc" },
];

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD and Worker Services so the
 * isolation rule stays in one shape across the module: branch membership is read
 * from the persisted WorkerBranch rows, never from the path, body or query, all
 * of which the caller controls. Returns an err() response in place of the record
 * when access is refused, matching requireAuth's `{ value, error }` convention.
 */
async function authorizeWorkerAccess(
  user: AuthUser,
  id: string
): Promise<
  | { worker: { id: string }; error: null }
  | { worker: null; error: ReturnType<typeof err> }
> {
  // Deny by default: a branch-scoped account with no branch must never fall
  // through to an unscoped read or write.
  if (user.userType === "BRANCH_ADMIN" && !user.branchId) {
    return {
      worker: null,
      error: err("Your account is not assigned to a branch", 403),
    };
  }

  const worker = await prisma.workerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      branches: { select: { branchId: true, isActive: true } },
    },
  });

  if (!worker) {
    return { worker: null, error: err("Worker not found", 404) };
  }

  if (
    user.userType === "BRANCH_ADMIN" &&
    !worker.branches.some((b) => b.branchId === user.branchId && b.isActive)
  ) {
    return {
      worker: null,
      error: err("Forbidden — worker belongs to another branch", 403),
    };
  }

  return { worker: { id: worker.id }, error: null };
}

/* ============================================================================
   GET /api/v1/admin/workers/[id]/skills — Skills this worker holds

   Drives the worker's skill-assignment panel and the competency badges on the
   public stylist profile.
============================================================================ */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    const skills = await prisma.workerSkill.findMany({
      where: { workerId: id },
      orderBy: WORKER_SKILL_ORDER,
      select: WORKER_SKILL_SELECT,
    });

    return ok(skills, "Worker skills fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PUT /api/v1/admin/workers/[id]/skills — Replace the worker's skills

   Replace-all semantics, matching Worker Services: the payload is the complete
   desired set, not a delta. An empty array is a legitimate instruction — it
   clears every skill — and is accepted rather than refused.

   An entry may be a bare skill id, or an object carrying a proficiency band.
   The object form is not decoration: WorkerSkill.proficiency is a real column,
   and accepting ids alone would silently reset every worker's competency to the
   default on each save.

   Every id is resolved against the Skill catalogue BEFORE anything is written. A
   bad id would otherwise only surface as a foreign-key violation after the
   deleteMany had already run — inside a transaction that then rolls back, so the
   data survives, but the caller gets an opaque error instead of being told which
   id was wrong.

   An inactive skill is refused: a retired competency must not re-enter the
   catalogue through a worker assignment.
============================================================================ */

type SkillEntry = { skillId: string; proficiency: number };

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (body === null) {
      return err("Invalid JSON body", 400);
    }

    // Accepted as a bare array, as { skillIds: [...] }, or as { skills: [...] } —
    // the last being the key this endpoint already shipped with, kept so existing
    // clients do not break.
    const raw: unknown = Array.isArray(body)
      ? body
      : ((body as { skillIds?: unknown; skills?: unknown }).skillIds ??
         (body as { skillIds?: unknown; skills?: unknown }).skills);

    if (!Array.isArray(raw)) {
      return err("Validation failed", 422, {
        skillIds: ["Expected an array of skill IDs"],
      });
    }

    // Normalize both accepted entry forms into one shape before validating, so a
    // malformed entry is reported against its position rather than swallowed.
    const entries: SkillEntry[] = [];

    for (const item of raw) {
      if (typeof item === "string") {
        if (!item.trim()) {
          return err("Validation failed", 422, {
            skillIds: ["Every entry must be a non-empty skill ID"],
          });
        }
        entries.push({ skillId: item.trim(), proficiency: DEFAULT_PROFICIENCY });
        continue;
      }

      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return err("Validation failed", 422, {
          skillIds: ["Every entry must be a skill ID or { skillId, proficiency }"],
        });
      }

      const { skillId, proficiency } = item as {
        skillId?: unknown;
        proficiency?: unknown;
      };

      if (typeof skillId !== "string" || !skillId.trim()) {
        return err("Validation failed", 422, {
          skillIds: ["Every entry must carry a non-empty skillId"],
        });
      }

      if (proficiency === undefined) {
        entries.push({ skillId: skillId.trim(), proficiency: DEFAULT_PROFICIENCY });
        continue;
      }

      const level = Number(proficiency);
      if (
        !Number.isInteger(level) ||
        level < MIN_PROFICIENCY ||
        level > MAX_PROFICIENCY
      ) {
        return err("Validation failed", 422, {
          proficiency: [
            `Proficiency must be an integer between ${MIN_PROFICIENCY} and ${MAX_PROFICIENCY}`,
          ],
        });
      }

      entries.push({ skillId: skillId.trim(), proficiency: level });
    }

    const skillIds = entries.map((e) => e.skillId);

    // A duplicate id is a malformed request, not something to silently collapse:
    // skipDuplicates would swallow it and the caller would never learn that one of
    // their two proficiency values had been discarded.
    const duplicates = [
      ...new Set(skillIds.filter((s, i) => skillIds.indexOf(s) !== i)),
    ];
    if (duplicates.length) {
      return err("Validation failed", 422, {
        skillIds: [`Duplicate skill IDs: ${duplicates.join(", ")}`],
      });
    }

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    // Skipped for an empty payload: there is nothing to resolve, and clearing the
    // set is always valid.
    if (skillIds.length) {
      const found = await prisma.skill.findMany({
        where: { id: { in: skillIds } },
        select: { id: true, isActive: true },
      });

      const foundIds = new Set(found.map((s) => s.id));
      const missing = skillIds.filter((s) => !foundIds.has(s));
      if (missing.length) {
        return err("Validation failed", 422, {
          skillIds: [`Unknown skill IDs: ${missing.join(", ")}`],
        });
      }

      const inactive = found.filter((s) => !s.isActive).map((s) => s.id);
      if (inactive.length) {
        return err("Validation failed", 422, {
          skillIds: [`Inactive skill IDs: ${inactive.join(", ")}`],
        });
      }
    }

    // Clear, re-insert and read back in one transaction, so a concurrent GET can
    // never observe the worker mid-swap with an empty skill list.
    const skills = await prisma.$transaction(async (tx) => {
      await tx.workerSkill.deleteMany({ where: { workerId: id } });

      if (entries.length) {
        await tx.workerSkill.createMany({
          data: entries.map((e) => ({
            workerId: id,
            skillId: e.skillId,
            proficiency: e.proficiency,
          })),
          // Belt-and-braces against the [workerId, skillId] unique constraint: the
          // duplicate check above already rejects them, so this can only fire on a
          // race, and dropping the row is the correct outcome either way.
          skipDuplicates: true,
        });
      }

      return tx.workerSkill.findMany({
        where: { workerId: id },
        orderBy: WORKER_SKILL_ORDER,
        select: WORKER_SKILL_SELECT,
      });
    });

    return ok(skills, "Skills updated");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        // Only reachable if a skill is deleted between validation and the write —
        // the pre-flight above turns every other bad id into a 422.
        case "P2003":
          return err("Validation failed", 422, {
            skillIds: ["One or more skill IDs no longer exist"],
          });
        case "P2025":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}
