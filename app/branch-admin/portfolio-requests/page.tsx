import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { PageHeader } from "@/components/shared/ui";
import { RequestsToolbar } from "@/components/portfolio-requests-admin/requests-toolbar";
import { RequestsView } from "@/components/portfolio-requests-admin/requests-view";
import type { AdminRequestRow } from "@/components/portfolio-requests-admin/types";

// OWNER: Gauransh | MODULE: Branch Admin — Portfolio Requests
//
// BACKEND: GET /api/v1/admin/portfolio-requests (search, status, type, page, limit)
//          PATCH /[id] (approve / reject / needs-changes) — via actions.ts
//
// The page NEVER touches Prisma and never re-applies branch isolation: the API
// resolves the caller's branch from the session and scopes the queue through the
// worker relation, so a branch admin only ever sees their own branch's requests.
// Fetched once, on the server, with URL-driven filters (shareable, refresh-safe).

/** Whitelisted before they reach the API — junk params never leave the page. */
const PASSTHROUGH = ["search", "status", "type", "page", "limit"] as const;

function friendlyError(status: number, message: string): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have access to portfolio requests for this branch.";
    case 0:
      return "Could not reach the server. Check your connection and try again.";
    case 500:
      return "Something went wrong on our end. Please try again shortly.";
    default:
      return message || "Could not load portfolio requests.";
  }
}

export default async function PortfolioRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();

  // proxy.ts gates /branch-admin/*; this is the second line and the API is the
  // third. A branch admin with no branch is refused by requireBranchScope anyway.
  if (!authUser?.branchId) redirect("/login");

  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    const value = raw[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v?.trim()) params.set(key, v.trim());
  }

  const result = await apiGet<Paginated<AdminRequestRow>>(
    `${API.admin.portfolioRequests}?${params.toString()}`
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Team"
        title="Portfolio requests"
        subtitle="Review and approve changes your workers propose to their professional portfolios."
      />

      <RequestsToolbar />

      {!result.ok ? (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <ClipboardList className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Could not load portfolio requests</h3>
          <p className="mt-1 text-xs text-gray-500">{friendlyError(result.status, result.message)}</p>
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-200">
            <ClipboardList className="size-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No requests to review</h3>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            When your workers submit portfolio changes, they will appear here for approval.
          </p>
        </div>
      ) : (
        <RequestsView
          requests={result.data.items}
          total={result.data.total}
          page={result.data.page}
          limit={result.data.limit}
          totalPages={result.data.totalPages}
        />
      )}
    </div>
  );
}
