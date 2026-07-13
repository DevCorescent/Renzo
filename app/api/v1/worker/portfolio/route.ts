import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

async function resolveWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const wp = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return wp?.id ?? null;
}

const CATEGORIES = ["HAIR", "MAKEUP", "NAILS", "SPA", "SKIN", "GROOMING", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

// OWNER: Aman | MODULE: Worker Portfolio
// GET /api/v1/worker/portfolio — Get own portfolio items
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { page, limit, skip } = parsePagination(new URL(req.url));

    const where = { workerId };
    const [items, total] = await Promise.all([
      prisma.workerPortfolio.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.workerPortfolio.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/worker/portfolio — Upload a new portfolio item (pending approval)
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const body = await req.json();
    if (!body.afterImage) return err("afterImage is required", 422);
    if (!CATEGORIES.includes(body.category as Category)) {
      return err(`category must be one of ${CATEGORIES.join(", ")}`, 422);
    }

    const item = await prisma.workerPortfolio.create({
      data: {
        workerId,
        category: body.category as Category,
        title: body.title ?? null,
        description: body.description ?? null,
        beforeImage: body.beforeImage ?? null,
        afterImage: body.afterImage,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
        // New uploads always start unapproved — admin approves via the admin route.
        isApproved: false,
      },
    });

    return created(item, "Portfolio item uploaded, pending approval");
  } catch {
    return err("Internal server error", 500);
  }
}
