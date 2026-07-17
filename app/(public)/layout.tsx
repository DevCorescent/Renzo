import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PublicChatbot } from "@/components/ai/public-chatbot";
import { getServerUser } from "@/lib/server-session";
import type { UserType } from "@/types/api";

// OWNER: Devanshi | LAYOUT: Public Website Layout (header + footer)
export const metadata: Metadata = {
  title: "Renzo — Hair & Beauty Studio",
  description:
    "Book haircuts, styling, colour and spa treatments at Renzo. Expert stylists, premium products, and a salon experience crafted around you.",
};

const DASHBOARD_FOR: Record<UserType, string> = {
  SUPER_ADMIN:       "/super-admin/dashboard",
  OWNER:             "/branch-admin/dashboard",
  BRANCH_ADMIN:      "/branch-admin/dashboard",
  RECEPTIONIST:      "/reception/dashboard",
  WORKER:            "/worker/dashboard",
  CUSTOMER:          "/customer/dashboard",
  INVENTORY_MANAGER: "/inventory/dashboard",
  MARKETING_MANAGER: "/marketing/dashboard",
  ACCOUNTANT:        "/accountant/dashboard",
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  const dashboardHref = user ? (DASHBOARD_FOR[user.userType] ?? null) : null;

  return (
    <div className="renzo-luxe flex min-h-screen flex-col bg-stone-950">
      <SiteHeader dashboardHref={dashboardHref} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <PublicChatbot />
    </div>
  );
}
