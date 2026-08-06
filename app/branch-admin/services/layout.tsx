import { requireModule } from "@/lib/server-session";

// OWNER: Aman | LAYOUT: Branch Admin — Services module guard
// page.tsx here is a client component, so the permission check lives in this
// pass-through server layout instead of at the top of the page.

export default async function BranchAdminServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("services");
  return <>{children}</>;
}
