import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Staff Management
// Manages non-worker admin staff: Branch Admins, Receptionists, Inventory
// Managers, Marketing Managers, Accountants.
// Super Admin / Owner only — these accounts have privileged access.

const STAFF_ROLES = [
  "BRANCH_ADMIN",
  "RECEPTIONIST",
  "INVENTORY_MANAGER",
  "MARKETING_MANAGER",
  "ACCOUNTANT",
] as const;

// Roles that must be tied to a specific branch.
const BRANCH_SCOPED_ROLES = ["BRANCH_ADMIN", "RECEPTIONIST", "INVENTORY_MANAGER", "ACCOUNTANT"];

// ─── GET /api/v1/admin/staff ─────────────────────────────────────────────────
// List all staff; filterable by branchId and userType.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const userType = url.searchParams.get("userType") ?? undefined;

    const where: Prisma.StaffProfileWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (userType && STAFF_ROLES.includes(userType as (typeof STAFF_ROLES)[number])) {
      where.user = { userType: userType as (typeof STAFF_ROLES)[number] };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.staffProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              userType: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.staffProfile.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// ─── POST /api/v1/admin/staff ────────────────────────────────────────────────
// Create a staff member and issue them a login account.
// Body: { firstName, lastName, userType, password, email?, phone?, branchId?, profilePhoto? }
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    // Validate required fields.
    const errors: Record<string, string[]> = {};
    if (!body.firstName?.trim()) errors.firstName = ["First name is required"];
    if (!body.lastName?.trim()) errors.lastName = ["Last name is required"];
    if (!body.userType) errors.userType = ["Role is required"];
    if (!body.password || body.password.length < 6)
      errors.password = ["Password must be at least 6 characters"];
    if (!body.email?.trim() && !body.phone?.trim())
      errors.email = ["Email or phone is required"];

    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    if (!STAFF_ROLES.includes(body.userType)) {
      return err(
        `userType must be one of: ${STAFF_ROLES.join(", ")}`,
        422
      );
    }

    if (BRANCH_SCOPED_ROLES.includes(body.userType) && !body.branchId) {
      return err(
        `branchId is required for the ${body.userType} role`,
        422
      );
    }

    const passwordHash = await hashPassword(body.password as string);

    const staff = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email?.trim().toLowerCase() ?? null,
          phone: body.phone?.trim() ?? null,
          passwordHash,
          userType: body.userType,
          isActive: true,
          isVerified: true,
        },
      });

      return tx.staffProfile.create({
        data: {
          userId: user.id,
          branchId: body.branchId ?? null,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          phone: body.phone?.trim() ?? null,
          email: body.email?.trim().toLowerCase() ?? null,
          profilePhoto: body.profilePhoto ?? null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              userType: true,
              isActive: true,
            },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
      });
    });

    return created(staff, `${body.userType.replace(/_/g, " ")} created successfully`);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return err("A user with that email or phone already exists", 409);
    if (code === "P2003") return err("Invalid branchId", 422);
    return err("Internal server error", 500);
  }
}
