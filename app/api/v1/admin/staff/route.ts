import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import { sendMail } from "@/lib/mailer";
import { workerWelcomeEmail } from "@/lib/email-templates";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Staff Management
//
// Role split:
//   SUPER_ADMIN  — creates saloon owners (OWNER, BRANCH_ADMIN)
//   OWNER / BRANCH_ADMIN — creates their own branch's operational staff
//                          (RECEPTIONIST, INVENTORY_MANAGER, MARKETING_MANAGER, ACCOUNTANT)

// Roles only SUPER_ADMIN can create — these have branch-level authority.
const SUPER_ONLY_ROLES = ["OWNER", "BRANCH_ADMIN"] as const;

// Roles a branch admin/owner can create for their own branch.
const BRANCH_STAFF_ROLES = [
  "RECEPTIONIST",
  "INVENTORY_MANAGER",
  "MARKETING_MANAGER",
  "ACCOUNTANT",
] as const;

const ALL_STAFF_ROLES = [...SUPER_ONLY_ROLES, ...BRANCH_STAFF_ROLES] as const;
type StaffRole = (typeof ALL_STAFF_ROLES)[number];

// ─── GET /api/v1/admin/staff ─────────────────────────────────────────────────
// SUPER_ADMIN → all staff across all branches
// OWNER / BRANCH_ADMIN → only their own branch's staff
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
    const userType = url.searchParams.get("userType") ?? undefined;

    const where: Prisma.StaffProfileWhereInput = {};

    // Branch admins / owners are scoped to their own branch automatically.
    if (user.userType === "BRANCH_ADMIN" || user.userType === "OWNER") {
      where.branchId = user.branchId ?? undefined;
    } else {
      // Super admin can optionally filter by branch.
      const branchId = url.searchParams.get("branchId") ?? undefined;
      if (branchId) where.branchId = branchId;
    }

    if (userType && ALL_STAFF_ROLES.includes(userType as StaffRole)) {
      where.user = { userType: userType as StaffRole };
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
// Body: { firstName, lastName, userType, password, email?, phone?, branchId?, profilePhoto? }
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
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const errors: Record<string, string[]> = {};
    if (!body.firstName?.trim()) errors.firstName = ["First name is required"];
    if (!body.lastName?.trim()) errors.lastName = ["Last name is required"];
    if (!body.userType) errors.userType = ["Role is required"];
    if (!body.password || body.password.length < 6)
      errors.password = ["Password must be at least 6 characters"];
    if (!body.email?.trim() && !body.phone?.trim())
      errors.email = ["Email or phone is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const role = body.userType as string;

    // OWNER / BRANCH_ADMIN can only create operational roles, not other admins.
    if (
      (user.userType === "OWNER" || user.userType === "BRANCH_ADMIN") &&
      SUPER_ONLY_ROLES.includes(role as (typeof SUPER_ONLY_ROLES)[number])
    ) {
      return err("Only Super Admin can create Owner or Branch Admin accounts", 403);
    }

    if (!ALL_STAFF_ROLES.includes(role as StaffRole)) {
      return err(`userType must be one of: ${ALL_STAFF_ROLES.join(", ")}`, 422);
    }

    // Resolve branchId:
    // — SUPER_ADMIN must supply it explicitly for branch-scoped roles.
    // — OWNER / BRANCH_ADMIN: always use their own branch.
    let branchId: string | null = body.branchId ?? null;
    if (user.userType === "OWNER" || user.userType === "BRANCH_ADMIN") {
      branchId = user.branchId ?? null;
    }

    const branchRequired = [...SUPER_ONLY_ROLES, ...BRANCH_STAFF_ROLES].includes(
      role as StaffRole
    );
    if (branchRequired && role !== "MARKETING_MANAGER" && !branchId) {
      return err("branchId is required for this role", 422);
    }

    const passwordHash = await hashPassword(body.password as string);

    const staff = await prisma.$transaction(async (tx) => {
      const account = await tx.user.create({
        data: {
          email: body.email?.trim().toLowerCase() ?? null,
          phone: body.phone?.trim() ?? null,
          passwordHash,
          userType: role as StaffRole,
          isActive: true,
          isVerified: true,
        },
      });

      return tx.staffProfile.create({
        data: {
          userId: account.id,
          branchId,
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

    // Send welcome email if an email address was provided — non-blocking.
    const recipientEmail = body.email?.trim().toLowerCase();
    if (recipientEmail) {
      const { subject, html, text } = workerWelcomeEmail({
        name: `${body.firstName.trim()} ${body.lastName.trim()}`,
        email: recipientEmail,
        password: body.password as string,
        branchName: staff.branch?.name ?? "Renzo",
      });
      void sendMail({ to: recipientEmail, subject, html, text });
    }

    return created(staff, `${role.replace(/_/g, " ")} created successfully`);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return err("A user with that email or phone already exists", 409);
    if (code === "P2003") return err("Invalid branchId", 422);
    return err("Internal server error", 500);
  }
}
