import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated, type WorkerListItem } from "@/lib/api-server";
import { WorkersDirectory } from "@/components/workers/workers-directory";
import { CreatedToast } from "@/components/workers/created-toast";
import { EmptyState } from "@/components/workers/worker-ui";
import { Card } from "@/components/shared/ui";

// Admission is a full page, not a drawer: the form carries sixteen fields across
// three sections and a photo upload, which is more than a slide-over can hold
// without becoming a scroll trap. A page is also linkable, and survives a refresh.
function AddWorkerButton() {
  return (
    <Link
      href="/branch-admin/workers/new"
      className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-3 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
    >
      <Plus className="size-4" aria-hidden="true" />
      Add worker
    </Link>
  );
}

// OWNER: Hemant | MODULE: Branch Admin Workers
//
// BACKEND: GET /api/v1/admin/workers  (search, isActive, isPublic, gender,
//          departmentId, designationId, sortBy, sortOrder, page, limit)
//
// The page NEVER touches Prisma. Branch isolation is not re-implemented here:
// the API resolves the caller's branch from the session cookie and scopes the
// query through WorkerBranch. A branchId in the URL is ignored by the route for a
// BRANCH_ADMIN, so it cannot be used to reach another branch — the UI does not
// have to be trusted to prevent that.

/** Whitelisted before they reach the API — junk params never leave the page. */
const PASSTHROUGH = [
  "isActive",
  "isPublic",
  "gender",
  "departmentId",
  "designationId",
  "sortBy",
  "sortOrder",
  "page",
  "limit",
] as const;

export default async function BranchAdminWorkersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();

  // proxy.ts already gates /branch-admin/*; this is the second line, and the API
  // is the third. A branch admin with no branch is refused everywhere.
  if (!authUser?.branchId) redirect("/login");

  const raw = await searchParams;

  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    const value = raw[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v?.trim()) params.set(key, v.trim());
  }

  const result = await apiGet<Paginated<WorkerListItem>>(
    `/api/v1/admin/workers?${params.toString()}`
  );

  if (!result.ok) {
    return (
      <Card>
        <EmptyState
          title="Could not load workers"
          hint={result.message}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <CreatedToast />

      <WorkersDirectory
        data={result.data}
        basePath="/branch-admin/workers"
        title="Workers"
        subtitle={`${result.data.total} in your branch`}
        params={params}
        action={<AddWorkerButton />}
        canManage
      />
    </div>
  );
}
