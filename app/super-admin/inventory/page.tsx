import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard";

// OWNER: Hemant | MODULE: Super Admin — Inventory

export default async function SuperAdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");
  const sp = await searchParams;

  return (
    <InventoryDashboard
      authUser={authUser}
      searchParams={sp}
      isSuperAdmin
      title="Inventory"
      subtitle="Stock, movements and reorder alerts across every branch."
    />
  );
}
