import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { GiftCardsManager } from "@/components/gift-cards/gift-cards-manager";

// OWNER: Gauransh | MODULE: Marketing Manager — Gift Cards
//
// PURPOSE: Full gift-card management for the Marketing Manager, reusing the existing
//          gift-card endpoints (list/create/update + analytics), now authorized for
//          MARKETING_MANAGER. The client manager drives search/filters/pagination.
// ACCESS : The /marketing layout restricts to MARKETING_MANAGER / SUPER_ADMIN / OWNER.

export default async function MarketingGiftCardsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  return <GiftCardsManager />;
}
