import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { CampaignChannel, CampaignStatus, Prisma } from "@prisma/client";

const CHANNELS: CampaignChannel[] = ["WHATSAPP", "SMS", "EMAIL", "PUSH"];

// OWNER: Shalmon | MODULE: Campaigns
// GET /api/v1/admin/campaigns — List campaigns (filter status, channel, branchId)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const branchId = url.searchParams.get("branchId");

    const where: Prisma.CampaignWhereInput = {
      ...(status ? { status: status as CampaignStatus } : {}),
      ...(channel ? { channel: channel as CampaignChannel } : {}),
      ...(branchId ? { branchId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.campaign.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/campaigns — Create a campaign (starts as DRAFT)
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    const errors: Record<string, string[]> = {};
    if (!name) errors.name = ["Name is required"];
    if (!CHANNELS.includes(body.channel)) errors.channel = ["Invalid channel"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description: typeof body.description === "string" ? body.description : null,
        channel: body.channel,
        branchId: typeof body.branchId === "string" ? body.branchId : null,
        templateId: typeof body.templateId === "string" ? body.templateId : null,
        targetSegment: body.targetSegment ?? undefined,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        status: body.scheduledAt ? "SCHEDULED" : "DRAFT",
        createdBy: user.userId,
      },
    });
    return created(campaign, "Campaign created");
  } catch {
    return err("Internal server error", 500);
  }
}
