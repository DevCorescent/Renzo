// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management
// ROUTE  : /api/v1/admin/workers
//
// METHODS
// GET    - List workers with pagination, search, sorting and filtering
// POST   - Create a new worker under a branch
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST   - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { sendMail } from "@/lib/mailer";
import { workerWelcomeEmail } from "@/lib/email-templates";

const GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;
type Gender = (typeof GENDERS)[number];

// 10–15 digits, optionally prefixed with a country code.
const PHONE_RE = /^\+?\d{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 6;

/** Trimmed non-empty string, or undefined. */
function trimmed(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Keep only the string entries of an optional string[] body field. */
function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

/**
 * The columns a P2002 (unique constraint) fired on. Prisma reports these in
 * `meta.target`; normalizing it lets us point the client at the exact field
 * that clashed instead of returning one vague "already exists" message for
 * three different unique columns (User.email, User.phone, WorkerProfile.employeeCode).
 */
function uniqueTargets(e: Prisma.PrismaClientKnownRequestError): string[] {
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

// Columns the admin table may sort on. Whitelisted rather than passed straight
// through, so a caller cannot order by an arbitrary column and turn the listing
// into an unindexed full-table sort.
const SORTABLE_FIELDS = [
  "createdAt",
  "joinDate",
  "firstName",
  "employeeCode",
] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

/* ============================================================================
   GET /api/v1/admin/workers — List workers

   Powers the admin worker table: pagination, search, filtering and sorting.

   Branch isolation:
     BRANCH_ADMIN — pinned to their own branch. A branchId in the query string is
                    ignored, never trusted. An account carrying no branch is
                    denied outright rather than falling through to an unfiltered
                    query, which would expose every worker on the platform.
     SUPER_ADMIN / OWNER — platform-level, so ?branchId is an optional narrowing
                    filter; its absence means "all branches".
============================================================================ */

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);

    // ------------------------------------------------------------------------
    // Branch isolation
    // ------------------------------------------------------------------------

    let branchId: string | undefined;

    if (user.userType === "BRANCH_ADMIN") {
      if (!user.branchId) {
        return err("Your account is not assigned to a branch", 403);
      }
      branchId = user.branchId;
    } else {
      branchId = trimmed(url.searchParams.get("branchId") ?? undefined);
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    const departmentId = trimmed(url.searchParams.get("departmentId") ?? undefined);
    const designationId = trimmed(url.searchParams.get("designationId") ?? undefined);
    const isActive = url.searchParams.get("isActive");
    const isPublic = url.searchParams.get("isPublic");
    const gender = url.searchParams.get("gender") as Gender | null;

    // ------------------------------------------------------------------------
    // Sorting
    // ------------------------------------------------------------------------

    const requestedSort = url.searchParams.get("sortBy") as SortField | null;
    const sortBy: SortField =
      requestedSort && SORTABLE_FIELDS.includes(requestedSort)
        ? requestedSort
        : "createdAt";
    const sortOrder: Prisma.SortOrder =
      url.searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    const where: Prisma.WorkerProfileWhereInput = {
      // WorkerProfile carries no branchId column — a worker's branch lives in the
      // WorkerBranch join table, and only an ACTIVE link counts as membership, so
      // a stale link cannot keep a transferred worker visible to their old branch.
      ...(branchId ? { branches: { some: { branchId, isActive: true } } } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(designationId ? { designationId } : {}),
      ...(isActive === "true" || isActive === "false"
        ? { isActive: isActive === "true" }
        : {}),
      ...(isPublic === "true" || isPublic === "false"
        ? { isPublic: isPublic === "true" }
        : {}),
      ...(gender && GENDERS.includes(gender) ? { gender } : {}),

      // Prisma ANDs the top-level keys, so this OR narrows within the branch and
      // filter set above — it can never widen past the caller's scope.
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { displayName: { contains: search, mode: "insensitive" as const } },
              { employeeCode: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        // The `id` tiebreaker keeps pagination stable: rows sharing a sort value
        // (two workers who joined on the same day) otherwise have no deterministic
        // order between queries, so one can surface on two consecutive pages while
        // another is skipped.
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        // Explicit field list — a listing has no business shipping bio, languages,
        // certificates or dateOfBirth to build a table row.
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          profilePhoto: true,
          phone: true,
          email: true,
          gender: true,
          experience: true,
          isActive: true,
          isPublic: true,
          joinDate: true,
          createdAt: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true, level: true } },
          branches: {
            select: {
              isPrimary: true,
              isActive: true,
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);

    return paginated(items, total, page, limit, "Workers fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/admin/workers — Create a worker under a branch

   Creates the worker's login account and profile, and attaches them to exactly
   one branch — all inside a single transaction, so a failure at any step leaves
   no orphaned User or WorkerProfile behind.

   Branch resolution:
     BRANCH_ADMIN — the branch ALWAYS comes from the authenticated session.
                    A branchId in the request body is ignored, never trusted;
                    otherwise a branch admin could plant a worker into another
                    branch and then manage them.
     SUPER_ADMIN / OWNER — platform-level roles, so they name the branch
                    explicitly in the body.
============================================================================ */

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    // ------------------------------------------------------------------------
    // Normalize
    // ------------------------------------------------------------------------

    const firstName = trimmed(body.firstName);
    const lastName = trimmed(body.lastName);
    const displayName = trimmed(body.displayName);
    const bio = trimmed(body.bio);
    const profilePhoto = trimmed(body.profilePhoto);
    const phone = trimmed(body.phone);
    const email = trimmed(body.email)?.toLowerCase();
    const employeeCode = trimmed(body.employeeCode)?.toUpperCase();
    const departmentId = trimmed(body.departmentId);
    const designationId = trimmed(body.designationId);
    const password = typeof body.password === "string" ? body.password : "";
    const gender = body.gender as Gender | undefined;

    // ------------------------------------------------------------------------
    // Branch resolution — before validation, so an unassigned branch admin is
    // rejected outright rather than being told which fields are missing.
    // ------------------------------------------------------------------------

    let branchId: string | undefined;

    if (user.userType === "BRANCH_ADMIN") {
      // Deny by default: a branch-scoped account with no branch must never fall
      // through to a body-supplied value.
      if (!user.branchId) {
        return err("Your account is not assigned to a branch", 403);
      }
      branchId = user.branchId;
    } else {
      branchId = trimmed(body.branchId);
    }

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    const errors: Record<string, string[]> = {};

    if (!firstName) {
      errors.firstName = ["First name is required"];
    } else if (firstName.length > 50) {
      errors.firstName = ["First name must be 50 characters or fewer"];
    }

    if (!lastName) {
      errors.lastName = ["Last name is required"];
    } else if (lastName.length > 50) {
      errors.lastName = ["Last name must be 50 characters or fewer"];
    }

    // The worker needs a login identity, and the OTP flow is phone-based.
    if (!phone) {
      errors.phone = ["Phone is required"];
    } else if (!PHONE_RE.test(phone)) {
      errors.phone = ["Phone must be 10–15 digits, optionally prefixed with +"];
    }

    // Email is optional, but must be well-formed when supplied.
    if (email && !EMAIL_RE.test(email)) {
      errors.email = ["Email is not a valid email address"];
    }

    if (!password) {
      errors.password = ["Password is required"];
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = [
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      ];
    }

    if (!employeeCode) {
      errors.employeeCode = ["Employee code is required"];
    }

    if (!gender || !GENDERS.includes(gender)) {
      errors.gender = [`Gender must be one of: ${GENDERS.join(", ")}`];
    }

    if (!branchId) {
      errors.branchId = ["Branch is required"];
    }

    // Optional date fields — reject unparseable values instead of storing
    // "Invalid Date".
    let dateOfBirth: Date | null = null;
    if (body.dateOfBirth != null && body.dateOfBirth !== "") {
      const parsed = new Date(body.dateOfBirth);
      if (Number.isNaN(parsed.getTime())) {
        errors.dateOfBirth = ["Date of birth is not a valid date"];
      } else {
        dateOfBirth = parsed;
      }
    }

    let joinDate: Date | undefined;
    if (body.joinDate != null && body.joinDate !== "") {
      const parsed = new Date(body.joinDate);
      if (Number.isNaN(parsed.getTime())) {
        errors.joinDate = ["Joining date is not a valid date"];
      } else {
        joinDate = parsed;
      }
    }

    let experience = 0;
    if (body.experience != null && body.experience !== "") {
      const parsed = Number(body.experience);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.experience = ["Experience must be a non-negative number of years"];
      } else {
        experience = parsed;
      }
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    // ------------------------------------------------------------------------
    // Branch must exist and be active.
    //
    // The FK would catch a bad id as a P2003 anyway, but that cannot tell an
    // inactive branch from a missing one — and a worker must never be attached
    // to a deactivated branch.
    // ------------------------------------------------------------------------

    const branch = await prisma.branch.findUnique({
      where: { id: branchId! },
      select: { id: true, name: true, isActive: true },
    });

    if (!branch) {
      return err("Validation failed", 422, { branchId: ["Branch not found"] });
    }
    if (!branch.isActive) {
      return err("Validation failed", 422, { branchId: ["Branch is inactive"] });
    }

    // Hashed OUTSIDE the transaction on purpose: PBKDF2 runs 100k iterations,
    // and holding a DB transaction open across it would pin a pooled Neon
    // connection for no reason.
    const passwordHash = await hashPassword(password);

    // ------------------------------------------------------------------------
    // Create User + WorkerProfile + WorkerBranch atomically.
    // If any step throws, the whole thing rolls back — no orphaned login
    // account, no worker without a branch.
    // ------------------------------------------------------------------------

    const worker = await prisma.$transaction(async (tx) => {
      const account = await tx.user.create({
        data: {
          email: email ?? null,
          phone: phone!,
          passwordHash,
          userType: "WORKER",
          isActive: true,
          isVerified: true,
        },
      });

      const profile = await tx.workerProfile.create({
        data: {
          userId: account.id,
          employeeCode: employeeCode!,
          firstName: firstName!,
          lastName: lastName!,
          displayName: displayName ?? null,
          bio: bio ?? null,
          profilePhoto: profilePhoto ?? null,
          phone: phone!,
          email: email ?? null,
          gender: gender!,
          dateOfBirth,
          ...(joinDate ? { joinDate } : {}),
          experience,
          languages: stringArray(body.languages),
          certificates: stringArray(body.certificates),
          // Workers stay off the public site until an admin opts them in.
          isPublic: body.isPublic === true,
          isActive: true,
          departmentId: departmentId ?? null,
          designationId: designationId ?? null,
        },
      });

      // A worker belongs to exactly one branch, so the first link is primary.
      await tx.workerBranch.create({
        data: {
          workerId: profile.id,
          branchId: branch.id,
          isPrimary: true,
          isActive: true,
        },
      });

      return tx.workerProfile.findUnique({
        where: { id: profile.id },
        include: {
          department: true,
          designation: true,
          branches: {
            include: { branch: { select: { id: true, name: true, code: true } } },
          },
        },
      });
    });

    // Send welcome email with login credentials (non-blocking).
    if (email) {
      const { subject, html, text } = workerWelcomeEmail({
        name: firstName!,
        email,
        password,
        branchName: branch.name,
      });
      sendMail({ to: email, subject, html, text });
    }

    return created(worker, "Worker created successfully");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        // Unique constraint — say exactly which field clashed.
        case "P2002": {
          const targets = uniqueTargets(e);

          if (targets.includes("email")) {
            return err("Validation failed", 409, {
              email: ["A user with this email already exists"],
            });
          }
          if (targets.includes("phone")) {
            return err("Validation failed", 409, {
              phone: ["A user with this phone number already exists"],
            });
          }
          if (
            targets.includes("employeeCode") ||
            targets.includes("employee_code")
          ) {
            return err("Validation failed", 409, {
              employeeCode: ["This employee code is already in use"],
            });
          }

          return err(
            "A user or worker with that email, phone, or employee code already exists",
            409
          );
        }

        // Foreign key — a departmentId / designationId / branchId that
        // does not exist.
        case "P2003":
          return err("Validation failed", 422, {
            departmentId: [
              "Invalid departmentId, designationId, or branchId",
            ],
          });

        // A related record required by the write was not found.
        case "P2025":
          return err("A referenced record no longer exists", 404);
      }
    }

    console.error("POST Admin Worker Error:", e);
    return err("Internal server error", 500);
  }
}
