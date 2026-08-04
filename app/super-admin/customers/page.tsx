import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import { CustomersPage, type RawSearchParams } from "@/components/customers/customer-page";

// MODULE: Super Admin — Customers
//
// proxy.ts gates /super-admin/*; this guard is the second line and the API is the
// third. It accepts OWNER as well as SUPER_ADMIN because proxy.ts and the customer
// API both admit them — rejecting OWNER here would bounce a user off a page they
// were just authenticated for, the same trap the workers and attendance pages
// already handle. (The previous version of this page checked SUPER_ADMIN alone.)
//
// The read-only table this replaced is now the shared CustomerView, which adds
// search, filters, walk-in entry, edit, soft delete, import and export. The
// per-customer link target is unchanged, so /super-admin/customers/[id] still
// receives exactly the same URLs it did before.

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <CustomersPage
      surface={{
        userType: authUser.userType,
        basePath: "/super-admin/customers",
        endpoint: API.admin.customers,
        bookingPath: null,
        eyebrow: "CRM",
        subtitle: "Every customer across all branches — walk-in, returning and online.",
      }}
      searchParams={await searchParams}
    />
  );
}
