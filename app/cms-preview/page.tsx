// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — draft preview
// ROUTE  : /cms-preview
//
// WHY THIS LIVES OUTSIDE /super-admin
// A preview is only useful if it is faithful. Rendered under the Super Admin
// segment it would inherit AppShell — sidebar, admin chrome, no public header or
// footer — and show something the visitor will never see. This route sits at the
// top level so it gets ONLY the root layout, then reproduces the public layout's
// exact structure (same wrapper classes, same header, same footer) around the
// DRAFT content.
//
// ACCESS : SUPER_ADMIN only — the same server-side check every admin page uses.
//          It reads the draft and never writes, so visiting it cannot publish
//          anything or alter what the public sees.
// ============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { HomeContentRenderer } from "@/components/public/home/home-content-renderer";
import { getServerUser } from "@/lib/server-session";
import { getDraft } from "@/lib/cms/store";

// The draft changes on every save, so this must never be cached.
export const dynamic = "force-dynamic";

// Belt and braces alongside the auth guard: an unpublished draft should never be
// indexed even if the route is somehow reached.
export const metadata: Metadata = {
  title: "Homepage draft preview — Renzo",
  robots: { index: false, follow: false },
};

export default async function CmsPreviewPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/staff/login");

  const draft = await getDraft();
  const { content } = draft;

  return (
    <div className="renzo-luxe flex min-h-screen flex-col bg-stone-950">
      {/* Draft marker — makes it impossible to mistake this for the live site.
          Nothing here exists on the real homepage. */}
      <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-b border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur">
        <span className="font-semibold uppercase tracking-widest">
          Draft preview — not published
        </span>
        <span className="text-stone-400">
          Last edited {new Date(draft.updatedAt).toLocaleString("en-IN")}
          {draft.updatedBy ? ` by ${draft.updatedBy}` : ""}
        </span>
        <Link
          href="/super-admin/cms/homepage"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 font-medium transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="size-3.5" />
          Back to editor
        </Link>
      </div>

      <SiteHeader branding={content.branding} />
      <div className="flex-1">
        <HomeContentRenderer content={content} />
      </div>
      <SiteFooter branding={content.branding} footer={content.footer} />
    </div>
  );
}
