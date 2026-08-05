import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import { CustomersPage, type RawSearchParams } from "@/components/customers/customer-page";

// MODULE: Branch Admin — Customers
//
// Scoping is NOT done here. requireBranchScope() in the API pins a BRANCH_ADMIN to
// the branch on their JWT and ignores any ?branchId they send, so this page can
// call the same endpoint the platform roles do and still only ever receive its own
// branch's customers (plus unassigned, self-registered ones).

const ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function BranchAdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !ROLES.includes(authUser.userType as (typeof ROLES)[number])) {
    redirect("/login");
  }

  return (
    <CustomersPage
      surface={{
        userType: authUser.userType,
        basePath: "/branch-admin/customers",
        endpoint: API.admin.customers,
        bookingPath: "/reception/booking/new",
        eyebrow: "CRM",
        subtitle: "Customers of your branch — add a walk-in in seconds.",
      }}
      searchParams={await searchParams}
    />
  );
}
