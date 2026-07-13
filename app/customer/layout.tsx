import { CustomerShell } from "@/components/customer/customer-shell";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

// OWNER: Devanshi | LAYOUT: Customer Portal

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getServerUser();
  if (!authUser?.customerId || authUser.userType !== "CUSTOMER") redirect("/login");

  let userName = "Customer";
  const customer = await prisma.customer.findUnique({
    where: { id: authUser.customerId },
    select: { firstName: true, lastName: true },
  });
  if (customer) userName = `${customer.firstName} ${customer.lastName ?? ""}`.trim();

  return <CustomerShell userName={userName}>{children}</CustomerShell>;
}
