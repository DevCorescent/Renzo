import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PublicChatbot } from "@/components/ai/public-chatbot";
import { getServerUser } from "@/lib/server-session";
import { getPublishedHomeContent } from "@/lib/cms/store";
import type { UserType } from "@/types/api";

// OWNER: Devanshi | LAYOUT: Public Website Layout (header + footer)
//
// The title/description are unchanged. The only dynamic part is the favicon: when
// a Super Admin publishes one it is advertised here, scoped to the PUBLIC site —
// the admin panel's own icon is untouched. With no CMS favicon set, no `icons`
// key is emitted at all, so Next resolves the app icon exactly as it did before.
export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getPublishedHomeContent();
  const favicon = branding.faviconUrl.trim();

  return {
    title: "Renzo — Hair & Beauty Studio",
    description:
      "Book haircuts, styling, colour and spa treatments at Renzo. Expert stylists, premium products, and a salon experience crafted around you.",
    ...(favicon ? { icons: { icon: favicon } } : {}),
  };
}

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
  const homepageContent = await getPublishedHomeContent();

 return (
  <div className="renzo-luxe relative flex min-h-screen flex-col overflow-x-hidden bg-transparent">
    <SiteHeader
      dashboardHref={dashboardHref}
      branding={homepageContent.branding}
    />

    <main className="flex-1">
      {children}
    </main>

    <SiteFooter
      branding={homepageContent.branding}
      footer={homepageContent.footer}
    />

    <PublicChatbot />
  </div>
);
}
