import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { CustomerProfile } from "@/components/customers/customer-profile";

// MODULE: Branch Admin — Customer detail
//
// Branch scoping is enforced by the API the profile reads through, not here.

const ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function BranchAdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !ROLES.includes(authUser.userType as (typeof ROLES)[number])) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <CustomerProfile
      id={id}
      backPath="/branch-admin/customers"
      bookingPath="/reception/booking/new"
    />
  );
}
