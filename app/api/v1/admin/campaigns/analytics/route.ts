// ============================================================================
// OWNER  : Gauransh
// MODULE : Campaign Analytics
// PURPOSE: Aggregate the existing Campaign + CampaignLog records into the Marketing
//          summary cards. Every figure is computed live — nothing stored, no new
//          column.
// BACKEND: Reuses Campaign + CampaignLog only; no duplicate logic.
// ACCESS : SUPER_ADMIN, OWNER, MARKETING_MANAGER (same as the campaign routes).
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// GET /api/v1/admin/campaigns/analytics
// Returns: totalCampaigns, activeCampaigns (SCHEDULED|RUNNING), completedCampaigns,
//          customerParticipation (DISTINCT customers across all CampaignLog).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const [total, active, completed, distinctCustomers] = await Promise.all([
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: { in: ["SCHEDULED", "RUNNING"] } } }),
      prisma.campaign.count({ where: { status: "COMPLETED" } }),
      prisma.campaignLog.findMany({ select: { customerId: true }, distinct: ["customerId"] }),
    ]);

    return ok({
      totalCampaigns: total,
      activeCampaigns: active,
      completedCampaigns: completed,
      customerParticipation: distinctCustomers.length,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
