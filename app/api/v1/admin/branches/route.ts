import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import { sendMail } from "@/lib/mailer";
import { workerWelcomeEmail } from "@/lib/email-templates";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Management
// GET /api/v1/admin/branches — List all branches paginated
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.branch.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/branches — Create a new branch
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();

    const required = [
      "name",
      "slug",
      "code",
      "address",
      "city",
      "state",
      "pincode",
      "phone",
    ];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(
        "Validation failed",
        422,
        Object.fromEntries(missing.map((f) => [f, ["This field is required"]]))
      );
    }

    // Optional branch admin account fields.
    const adminEmail = typeof body.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : null;
    const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword : null;
    const adminFirstName = typeof body.adminFirstName === "string" ? body.adminFirstName.trim() : null;
    const adminLastName = typeof body.adminLastName === "string" ? body.adminLastName.trim() : null;
    const createAdmin = !!(adminEmail && adminPassword && adminFirstName && adminLastName);

    if (createAdmin && adminPassword!.length < 6) {
      return err("Admin password must be at least 6 characters", 422);
    }

    const adminPasswordHash = createAdmin ? await hashPassword(adminPassword!) : null;

    const branch = await prisma.$transaction(async (tx) => {
      const b = await tx.branch.create({
        data: {
          name: body.name,
          slug: body.slug,
          code: body.code,
          address: body.address,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          country: body.country ?? "India",
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          phone: body.phone,
          email: body.email ?? null,
          whatsapp: body.whatsapp ?? null,
          mapUrl: body.mapUrl ?? null,
          coverImage: body.coverImage ?? null,
          description: body.description ?? null,
          isActive: body.isActive ?? true,
          isPublic: body.isPublic ?? true,
          sortOrder: body.sortOrder ?? 0,
        },
      });

      if (createAdmin) {
        const adminUser = await tx.user.create({
          data: {
            email: adminEmail,
            passwordHash: adminPasswordHash!,
            userType: "BRANCH_ADMIN",
            isActive: true,
            isVerified: true,
          },
        });
        await tx.staffProfile.create({
          data: {
            userId: adminUser.id,
            branchId: b.id,
            firstName: adminFirstName!,
            lastName: adminLastName!,
            email: adminEmail,
          },
        });
      }

      return b;
    });

    // Send welcome email after commit — non-blocking, never fails the response.
    if (createAdmin && adminEmail) {
      const { subject, html, text } = workerWelcomeEmail({
        name: `${adminFirstName} ${adminLastName}`,
        email: adminEmail,
        password: adminPassword!,
        branchName: branch.name,
      });
      void sendMail({ to: adminEmail, subject, html, text });
    }

    return created(branch);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") return err("A branch with that slug or code already exists — or that admin email is taken", 409);
    return err("Internal server error", 500);
  }
}
