import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

// OWNER: Devanshi | LAYOUT: Public Website Layout (header + footer)
export const metadata: Metadata = {
  title: "Renzo — Hair & Beauty Studio",
  description:
    "Book haircuts, styling, colour and spa treatments at Renzo. Expert stylists, premium products, and a salon experience crafted around you.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
