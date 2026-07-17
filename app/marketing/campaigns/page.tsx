import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { CampaignsManager } from "@/components/campaigns/campaigns-manager";

// OWNER: Gauransh | MODULE: Marketing Manager — Campaigns
//
// PURPOSE: Full campaign management for the Marketing Manager, reusing the existing
//          campaign endpoints (list/create/update + analytics). The client manager
//          drives search/filters/pagination and CRUD.
// ACCESS : The /marketing layout restricts to MARKETING_MANAGER / SUPER_ADMIN / OWNER
//          — the same roles the campaign routes authorize.

export default async function MarketingCampaignsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  return <CampaignsManager />;
}
