// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management
// ROUTE  : /api/v1/admin/workers/[id]
//
// METHODS
// GET    - Get complete worker profile
// PATCH  - Update worker profile
// DELETE - Deactivate worker (soft delete)
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PATCH  - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// DELETE - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

const GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;
type Gender = (typeof GENDERS)[number];

// 10–15 digits, optionally prefixed with a country code.
const PHONE_RE = /^\+?\d{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME_LENGTH = 50;

/** Trimmed non-empty string, or undefined. */
function trimmed(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Keep only the non-empty string entries of a string[] body field. */
function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

/**
 * Resolve whether the caller may WRITE to this worker, and hand back the facts
 * both write paths need — the login account the profile drives, and its branch
 * links.
 *
 * PATCH and DELETE share this so the isolation rule cannot drift apart between
 * them: a branch admin editing a worker and a branch admin deactivating one must
 * be answerable by exactly the same predicate. Branch membership is resolved from
 * the persisted WorkerBranch rows — never from the body, the query string or the
 * path — because those are all attacker-controlled.
 *
 * Returns an err() response in place of the record when access is refused, and
 * mirrors requireAuth's `{ value, error }` shape so call sites read the same way.
 */
async function authorizeWorkerWrite(
  user: AuthUser,
  id: string
): Promise<
  | { worker: { userId: string }; error: null }
  | { worker: null; error: ReturnType<typeof err> }
> {
  // Deny by default: a branch-scoped account with no branch must never fall
  // through to an unscoped write.
  if (user.userType === "BRANCH_ADMIN" && !user.branchId) {
    return {
      worker: null,
      error: err("Your account is not assigned to a branch", 403),
    };
  }

  const worker = await prisma.workerProfile.findUnique({
    where: { id },
    select: {
      userId: true,
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

  return { worker: { userId: worker.userId }, error: null };
}

/* ============================================================================
   GET /api/v1/admin/workers/[id] — Worker profile

   Returns the profile, its login account, department, designation and primary
   branch, plus lightweight counts for the related collections.

   Skills, services, portfolio and availability are NOT expanded here — each has
   its own dedicated endpoint and stays independently paginated. Only their
   counts are returned, so the details page can render tab badges without this
   route degrading into a full object graph fetch as a worker accumulates
   portfolio items and availability blocks.

   Branch isolation:
     BRANCH_ADMIN — may only read a worker linked to their own branch. Membership
                    is resolved through the WorkerBranch relation, never from the
                    request. An account carrying no branch is denied outright.
     SUPER_ADMIN / OWNER — platform-level, unrestricted.
============================================================================ */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    // A branch-scoped account with no branch must never fall through to an
    // unscoped read.
    if (user.userType === "BRANCH_ADMIN" && !user.branchId) {
      return err("Your account is not assigned to a branch", 403);
    }

    // One round trip: profile + user + lookups + branch links + relation counts.
    // `_count` is aggregated by the database, so the counts cost no extra
    // queries and no rows are transferred for the collections themselves.
    const worker = await prisma.workerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        phone: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        experience: true,
        languages: true,
        certificates: true,
        isPublic: true,
        isActive: true,
        joinDate: true,
        createdAt: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            userType: true,
            isActive: true,
            isVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },

        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true, level: true } },

        // Every link is selected, not just the primary one: the same rows serve
        // both the branch-isolation check below and the primaryBranch we surface.
        branches: {
          select: {
            branchId: true,
            isPrimary: true,
            isActive: true,
            joinedAt: true,
            branch: {
              select: { id: true, name: true, code: true, city: true },
            },
          },
        },

        _count: {
          select: {
            skills: true,
            services: true,
            portfolios: true,
            availability: true,
          },
        },
      },
    });

    if (!worker) return err("Worker not found", 404);

    // Branch isolation — resolved from the persisted WorkerBranch links, never
    // from anything the caller sent.
    if (
      user.userType === "BRANCH_ADMIN" &&
      !worker.branches.some((b) => b.branchId === user.branchId && b.isActive)
    ) {
      return err("Forbidden — worker belongs to another branch", 403);
    }

    // The links and the raw counts are shaped into the response below, so they
    // are lifted out of the profile rather than leaking through as-is.
    const { branches, _count, ...profile } = worker;

    // A worker belongs to exactly one branch, so the primary active link is the
    // one the details page shows. Fall back to any active link if the primary
    // flag was never set on legacy rows.
    const primary =
      branches.find((b) => b.isPrimary && b.isActive) ??
      branches.find((b) => b.isActive) ??
      null;

    return ok(
      {
        ...profile,
        primaryBranch: primary?.branch ?? null,
        joinedBranchAt: primary?.joinedAt ?? null,
        totalSkills: _count.skills,
        totalServices: _count.services,
        totalPortfolioItems: _count.portfolios,
        totalAvailabilityBlocks: _count.availability,
      },
      "Worker fetched successfully"
    );
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PATCH /api/v1/admin/workers/[id] — Update worker profile

   Partial update against a strict whitelist. Only keys the client actually sent
   are touched: a PATCH must never null out a field the caller never mentioned,
   which is why every branch below is gated on `in body` rather than on the value
   being falsy.

   Validation mirrors POST /admin/workers exactly — a field is either rejected on
   the way in or stored clean. The two endpoints writing the same columns to
   different standards is how a table ends up holding "Invalid Date" and
   unroutable phone numbers.

   Branch isolation is enforced through the shared write guard, so a branch admin
   cannot edit a worker outside their own branch.
============================================================================ */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    const { error: accessError } = await authorizeWorkerWrite(user, id);
    if (accessError) return accessError;

    const data: Prisma.WorkerProfileUncheckedUpdateInput = {};
    const errors: Record<string, string[]> = {};

    if ("firstName" in body) {
      const value = trimmed(body.firstName);
      if (!value) {
        errors.firstName = ["First name is required"];
      } else if (value.length > MAX_NAME_LENGTH) {
        errors.firstName = [`First name must be ${MAX_NAME_LENGTH} characters or fewer`];
      } else {
        data.firstName = value;
      }
    }

    if ("lastName" in body) {
      const value = trimmed(body.lastName);
      if (!value) {
        errors.lastName = ["Last name is required"];
      } else if (value.length > MAX_NAME_LENGTH) {
        errors.lastName = [`Last name must be ${MAX_NAME_LENGTH} characters or fewer`];
      } else {
        data.lastName = value;
      }
    }

    // Free-text fields are clearable — an empty string means "remove this".
    if ("displayName" in body) data.displayName = trimmed(body.displayName) ?? null;
    if ("bio" in body) data.bio = trimmed(body.bio) ?? null;
    if ("profilePhoto" in body) data.profilePhoto = trimmed(body.profilePhoto) ?? null;

    // Phone is the worker's login identity, so it may be corrected but never blanked.
    if ("phone" in body) {
      const value = trimmed(body.phone);
      if (!value) {
        errors.phone = ["Phone is required"];
      } else if (!PHONE_RE.test(value)) {
        errors.phone = ["Phone must be 10–15 digits, optionally prefixed with +"];
      } else {
        data.phone = value;
      }
    }

    if ("email" in body) {
      const value = trimmed(body.email)?.toLowerCase();
      if (!value) {
        data.email = null;
      } else if (!EMAIL_RE.test(value)) {
        errors.email = ["Email is not a valid email address"];
      } else {
        data.email = value;
      }
    }

    if ("gender" in body) {
      const value = body.gender as Gender;
      if (!GENDERS.includes(value)) {
        errors.gender = [`Gender must be one of: ${GENDERS.join(", ")}`];
      } else {
        data.gender = value;
      }
    }

    // Reject an unparseable date rather than persisting "Invalid Date".
    if ("dateOfBirth" in body) {
      if (body.dateOfBirth == null || body.dateOfBirth === "") {
        data.dateOfBirth = null;
      } else {
        const parsed = new Date(body.dateOfBirth);
        if (Number.isNaN(parsed.getTime())) {
          errors.dateOfBirth = ["Date of birth is not a valid date"];
        } else {
          data.dateOfBirth = parsed;
        }
      }
    }

    if ("experience" in body) {
      const parsed = Number(body.experience);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.experience = ["Experience must be a non-negative number of years"];
      } else {
        data.experience = parsed;
      }
    }

    if ("languages" in body) {
      if (!Array.isArray(body.languages)) {
        errors.languages = ["Languages must be an array of strings"];
      } else {
        data.languages = stringArray(body.languages);
      }
    }

    if ("certificates" in body) {
      if (!Array.isArray(body.certificates)) {
        errors.certificates = ["Certificates must be an array of strings"];
      } else {
        data.certificates = stringArray(body.certificates);
      }
    }

    if ("isPublic" in body) {
      if (typeof body.isPublic !== "boolean") {
        errors.isPublic = ["isPublic must be a boolean"];
      } else {
        data.isPublic = body.isPublic;
      }
    }

    if ("isActive" in body) {
      if (typeof body.isActive !== "boolean") {
        errors.isActive = ["isActive must be a boolean"];
      } else {
        data.isActive = body.isActive;
      }
    }

    // Lookups are clearable; a bad id surfaces as a P2003 below.
    if ("departmentId" in body) data.departmentId = trimmed(body.departmentId) ?? null;
    if ("designationId" in body) data.designationId = trimmed(body.designationId) ?? null;

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    if (Object.keys(data).length === 0) {
      return err("No valid fields to update", 422);
    }

    const worker = await prisma.workerProfile.update({ where: { id }, data });
    return ok(worker, "Worker updated");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case "P2025":
          return err("Worker not found", 404);
        case "P2002":
          return err("Email or phone already in use", 409);
        case "P2003":
          return err("Validation failed", 422, {
            departmentId: ["Invalid departmentId or designationId"],
          });
      }
    }
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   DELETE /api/v1/admin/workers/[id] — Deactivate worker (soft delete)

   Never a hard delete: a worker is referenced by appointments, attendance,
   commission entries and payroll, and destroying the row would take the salon's
   operating history with it.

   All three writes land in one transaction because they are a single security
   act. Revoking the sessions is the part that actually ends access — the JWT is
   verified statelessly, so flipping User.isActive alone would leave any token
   the worker already holds working until it expires.
============================================================================ */

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const { worker, error: accessError } = await authorizeWorkerWrite(user, id);
    if (accessError) return accessError;

    await prisma.$transaction([
      prisma.workerProfile.update({
        where: { id },
        data: { isActive: false, isPublic: false },
      }),
      prisma.user.update({
        where: { id: worker.userId },
        data: { isActive: false },
      }),
      prisma.session.deleteMany({ where: { userId: worker.userId } }),
    ]);

    return ok(null, "Worker deactivated");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return err("Worker not found", 404);
    }
    return err("Internal server error", 500);
  }
}
