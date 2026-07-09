import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Campaigns
// GET /api/v1/admin/campaigns/[id] — Campaign detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { template: true, _count: { select: { logs: true } } },
    });
    if (!campaign) return err("Campaign not found", 404);
    return ok(campaign);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/campaigns/[id] — Edit while DRAFT/SCHEDULED, or change status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return err("Campaign not found", 404);

    // Content edits are only allowed before a campaign has gone out.
    const editable = existing.status === "DRAFT" || existing.status === "SCHEDULED";
    const wantsContentEdit =
      body.name != null || body.description != null || body.templateId != null ||
      body.targetSegment != null || body.scheduledAt != null;
    if (wantsContentEdit && !editable) {
      return err(`Cannot edit a campaign in ${existing.status} state`, 409);
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.templateId === "string" ? { templateId: body.templateId } : {}),
        ...(body.targetSegment != null ? { targetSegment: body.targetSegment } : {}),
        ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
        ...(typeof body.status === "string"
          ? { status: body.status as typeof existing.status }
          : {}),
      },
    });
    return ok(campaign, "Campaign updated");
  } catch {
    return err("Internal server error", 500);
  }
}
