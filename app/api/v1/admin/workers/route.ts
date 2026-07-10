import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

const GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

// OWNER: Aman | MODULE: Worker Management
// GET /api/v1/admin/workers — List all workers paginated, filterable by branch
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId") ?? undefined;

    const where: Prisma.WorkerProfileWhereInput = {
      ...(branchId ? { branches: { some: { branchId } } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { employeeCode: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          department: true,
          designation: true,
          branches: { include: { branch: { select: { id: true, name: true } } } },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/workers — Create worker profile + user account
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json();

    // A worker needs a login account, so require an email or phone.
    const required = ["firstName", "lastName", "employeeCode", "gender"];
    const missing = required.filter((f) => !body[f]);
    if (!body.email && !body.phone) missing.push("email or phone");
    if (missing.length) {
      return err(
        "Validation failed",
        422,
        Object.fromEntries(missing.map((f) => [f, ["This field is required"]]))
      );
    }
    if (!GENDERS.includes(body.gender)) {
      return err("gender must be one of MALE, FEMALE, UNISEX", 422);
    }

    const worker = await prisma.$transaction(async (tx) => {
      const passwordHash =
        body.password && typeof body.password === "string" && body.password.length >= 6
          ? await hashPassword(body.password as string)
          : null;

      const account = await tx.user.create({
        data: {
          email: body.email ?? null,
          phone: body.phone ?? null,
          passwordHash,
          userType: "WORKER",
          isActive: true,
          isVerified: true,
        },
      });

      const profile = await tx.workerProfile.create({
        data: {
          userId: account.id,
          employeeCode: body.employeeCode,
          firstName: body.firstName,
          lastName: body.lastName,
          displayName: body.displayName ?? null,
          bio: body.bio ?? null,
          profilePhoto: body.profilePhoto ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          gender: body.gender,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
          experience: typeof body.experience === "number" ? body.experience : 0,
          languages: Array.isArray(body.languages) ? body.languages : [],
          certificates: Array.isArray(body.certificates) ? body.certificates : [],
          isPublic: body.isPublic ?? false,
          departmentId: body.departmentId ?? null,
          designationId: body.designationId ?? null,
        },
      });

      // Branch Admin always assigns to their own branch.
      // Super Admin / Owner supply branchId explicitly (optional).
      const assignBranchId =
        user.userType === "BRANCH_ADMIN" || user.userType === "OWNER"
          ? (user.branchId ?? body.branchId ?? null)
          : (body.branchId ?? null);

      if (assignBranchId) {
        await tx.workerBranch.create({
          data: { workerId: profile.id, branchId: assignBranchId, isPrimary: true },
        });
      }

      return profile;
    });

    const full = await prisma.workerProfile.findUnique({
      where: { id: worker.id },
      include: { department: true, designation: true, branches: true },
    });

    return created(full);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      return err(
        "A user or worker with that email, phone, or employee code already exists",
        409
      );
    }
    if ((e as { code?: string })?.code === "P2003") {
      return err("Invalid departmentId, designationId, or branchId", 422);
    }
    return err("Internal server error", 500);
  }
}
