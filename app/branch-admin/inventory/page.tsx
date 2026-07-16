import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard";

// OWNER: Hemant | MODULE: Branch Admin — Inventory

export default async function BranchAdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const sp = await searchParams;

  return (
    <InventoryDashboard
      authUser={authUser}
      searchParams={sp}
      isSuperAdmin={false}
      title="Inventory"
      subtitle="Stock levels, movements and reorder alerts for your branch."
    />
  );
}
