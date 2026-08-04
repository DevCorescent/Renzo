import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import { CustomersPage, type RawSearchParams } from "@/components/customers/customer-page";

// MODULE: Reception — Customers
//
// The front desk's book. Same page as the admin one; the capability table gives a
// RECEPTIONIST create and edit but not delete, import or export, and the API
// enforces exactly that — the hidden buttons are a convenience, not the control.
//
// The duplicate prompt links straight to the new-booking screen, which is the
// whole point of the walk-in flow: find or create the customer, then book them.

const ROLES = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function ReceptionCustomersPage({
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
        basePath: "/reception/customers",
        endpoint: API.reception.customers,
        bookingPath: "/reception/booking/new",
        eyebrow: "Front desk",
        subtitle: "Find a customer, or add a walk-in and book them straight away.",
      }}
      searchParams={await searchParams}
    />
  );
}
