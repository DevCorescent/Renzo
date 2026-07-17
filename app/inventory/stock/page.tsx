import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { PackageX } from "lucide-react";
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard";
import { EmptyState } from "@/components/dashboard/empty-state";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory Manager — Stock (branch inventory management)
// PURPOSE: Give the Inventory Manager the full inventory-management UI (the same
//          shared InventoryDashboard used by Super/Branch Admin), focused on THEIR
//          branch. Reuses the existing stock/product/adjust APIs — no new endpoints,
//          no duplicated logic.
//
// SCOPE  : INVENTORY_MANAGER is a GLOBAL role in the backend scope layer (unchanged),
//          so this page forwards their StaffProfile branch on reads and writes to keep
//          the view branch-focused. A visiting SUPER_ADMIN/OWNER (the layout also
//          admits them) gets the normal global view.
// ============================================================================

export default async function InventoryStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const sp = await searchParams;

  // A visiting platform role keeps their organization-wide view.
  const isPlatform = authUser.userType === "SUPER_ADMIN" || authUser.userType === "OWNER";
  if (isPlatform) {
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

  // Inventory Manager without an assigned branch cannot be scoped — fail safe with a
  // clear notice rather than silently showing all branches.
  if (!authUser.branchId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your branch&rsquo;s products and stock.</p>
        </div>
        <EmptyState icon={PackageX} title="No branch assigned" description="Your account isn't linked to a branch yet, so branch inventory can't be shown. Ask a Super Admin to assign your branch." />
      </div>
    );
  }

  return (
    <InventoryDashboard
      authUser={authUser}
      searchParams={sp}
      isSuperAdmin={false}
      fixedBranchId={authUser.branchId}
      canManage
      showBranchColumn={false}
      title="Inventory"
      subtitle="Manage your branch's products and stock."
    />
  );
}
