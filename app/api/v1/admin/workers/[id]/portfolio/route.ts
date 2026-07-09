import { NextRequest } from "next/server";
import { ok, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Portfolio Approval
// GET /api/v1/admin/workers/[id]/portfolio — List portfolio items for a worker
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);

    // Optional ?approved=true|false filter for the moderation queue.
    const approvedParam = url.searchParams.get("approved");
    const where = {
      workerId: id,
      ...(approvedParam === "true"
        ? { isApproved: true }
        : approvedParam === "false"
        ? { isApproved: false }
        : {}),
    };

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

// POST /api/v1/admin/workers/[id]/portfolio — Approve or reject a portfolio item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.portfolioId) return err("portfolioId is required", 422);
    if (typeof body.approve !== "boolean") {
      return err("approve must be a boolean", 422);
    }

    // Ensure the item belongs to this worker before mutating it.
    const item = await prisma.workerPortfolio.findFirst({
      where: { id: body.portfolioId, workerId: id },
      select: { id: true },
    });
    if (!item) return err("Portfolio item not found for this worker", 404);

    const updated = await prisma.workerPortfolio.update({
      where: { id: body.portfolioId },
      data: {
        isApproved: body.approve,
        approvedBy: body.approve ? user.userId : null,
        approvedAt: body.approve ? new Date() : null,
      },
    });

    return ok(updated, body.approve ? "Portfolio item approved" : "Portfolio item rejected");
  } catch {
    return err("Internal server error", 500);
  }
}
