import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { CouponsManager } from "@/components/coupons/coupons-manager";

// OWNER: Gauransh | MODULE: Marketing Manager — Coupons
//
// PURPOSE: Full coupon management for the Marketing Manager, reusing the existing
//          coupon endpoints (list/create/update/delete + analytics). The client
//          manager drives search/filters/pagination and CRUD.
// ACCESS : The /marketing layout already restricts to MARKETING_MANAGER / SUPER_ADMIN
//          / OWNER — the same roles the coupon routes authorize; this is the second
//          line of defence.

export default async function MarketingCouponsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  return <CouponsManager />;
}
