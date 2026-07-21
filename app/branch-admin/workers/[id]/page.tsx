import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { getWorkerWorkspace } from "@/lib/worker-workspace";
import { WorkerProfileView } from "@/components/worker-workspace/worker-profile-view";
import { Workspace } from "@/components/worker-workspace/workspace";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";
import { DashThemeInit } from "@/components/dashboard/dash-theme-init";

// OWNER: Gauransh | MODULE: Branch Admin — Worker Workspace
//
// The Branch Admin entry to the unified Worker Workspace. Branch isolation is
// enforced in the fetch (getWorkerWorkspace refuses a worker outside the admin's
// branch, resolved through WorkerBranch), so this page adds no isolation of its
// own — a worker in another branch simply resolves to notFound(), which also
// avoids revealing that the worker exists elsewhere.

export default async function BranchAdminWorkerWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  // proxy.ts gates /branch-admin/*; this is the second line and the fetch is the
  // third. A branch admin with no branch is refused by the fetch.
  if (!authUser?.branchId) redirect("/login");

  const { id } = await params;
  const data = await getWorkerWorkspace(id, authUser);
  if (!data) notFound();

  // The whole page renders inside the shared dashboard theme root (#sa-dash-root):
  // the `dark` class the app toggles lives on this element, and the scoped `.sa-dash`
  // tokens + `dark:` variants below inherit from it. Without this wrapper the page
  // had no themed ancestor, so it always painted light while the rest of the ERP
  // was dark. DashThemeInit applies the saved/OS theme before paint (no flash).
  return (
    <div
      id={THEME_ROOT_ID}
      suppressHydrationWarning
      className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6"
    >
      <DashThemeInit />
      <div className="space-y-5">
        <Link
          href="/branch-admin/workers"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900 dark:text-(--sa-text-2) dark:hover:text-(--sa-text)"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Back to workers
        </Link>

        <WorkerProfileView data={data} />

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
          <div className="mb-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-(--sa-text)">
              Worker details
            </h2>
            <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
              Portfolio, schedule, attendance, leave, services, performance and records.
            </p>
          </div>
          <Workspace data={data} includeOverview={false} />
        </section>
      </div>
    </div>
  );
}
