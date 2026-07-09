import type { Metadata } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";

// OWNER: Devanshi | LAYOUT: Customer Portal Layout (sidebar nav)
export const metadata: Metadata = {
  title: "My Account — Renzo",
  description: "Manage your bookings, wallet, membership and rewards.",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
