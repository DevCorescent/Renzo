import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import { pinnedServiceIds, setServicePin } from "@/lib/service-pins";
import prisma from "@/lib/db";

// MODULE: Services — Walk-in pins (see lib/service-pins.ts)
//
// GET  /api/v1/admin/branch-services/pins?branchId=   → { serviceIds } in pin order
// POST /api/v1/admin/branch-services/pins             → { serviceId, pinned, branchId? }
//
// BRANCH_ADMIN manages its own branch only (any branchId it sends is ignored);
// SUPER_ADMIN / OWNER name the branch, falling back to the branch on their own
// account — as /admin/branch-services does. Receptionists use the pins, they
// don't set them.
const ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"] as const;

/** The branch this request may act on, or an error response. */
function targetBranch(
  scope: { isGlobal: boolean; branchId: string | null },
  requested: unknown,
  ownBranchId: string | undefined
): { branchId: string } | { error: ReturnType<typeof err> } {
  if (!scope.isGlobal) return { branchId: scope.branchId! };
  const branchId = (typeof requested === "string" ? requested.trim() : "") || ownBranchId || "";
  if (!branchId) return { error: err("Validation failed", 422, { branchId: ["branchId is required"] }) };
  return { branchId };
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;
  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  const target = targetBranch(scope, new URL(req.url).searchParams.get("branchId"), user.branchId);
  if ("error" in target) return target.error;

  try {
    return ok({ branchId: target.branchId, serviceIds: await pinnedServiceIds(target.branchId) });
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;
  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    if (!serviceId) return err("Validation failed", 422, { serviceId: ["serviceId is required"] });
    if (typeof body.pinned !== "boolean") {
      return err("Validation failed", 422, { pinned: ["pinned must be true or false"] });
    }

    const target = targetBranch(scope, body.branchId, user.branchId);
    if ("error" in target) return target.error;

    const [branch, service] = await Promise.all([
      prisma.branch.findUnique({ where: { id: target.branchId }, select: { id: true } }),
      prisma.service.findUnique({ where: { id: serviceId }, select: { id: true, name: true, isActive: true } }),
    ]);
    if (!branch) return err("Branch not found", 404);
    if (!service) return err("Service not found", 404);
    // An inactive service is not in the Walk-in list, so it cannot be pinned —
    // but it can always be unpinned.
    if (body.pinned && !service.isActive) return err("An inactive service cannot be pinned", 409);

    await setServicePin({ branchId: target.branchId, serviceId, pinned: body.pinned, userId: user.userId });
    await writeAudit(user, {
      action: "UPDATE",
      module: "SERVICES",
      refId: serviceId,
      refType: "ServicePin",
      newValue: { branchId: target.branchId, serviceId, pinned: body.pinned },
    });

    return ok(
      { branchId: target.branchId, serviceId, pinned: body.pinned },
      body.pinned ? `${service.name} pinned to Walk-in` : `${service.name} unpinned`
    );
  } catch {
    return err("Internal server error", 500);
  }
}
