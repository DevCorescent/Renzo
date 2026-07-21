"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio Requests (table + drawer orchestrator)
//
// The interactive shell: the request table, the row → review drawer, pagination
// and the toast. Data arrives as props from the Server Component (fetched once, on
// the server, already branch-scoped). Review calls the Server Action, which PATCHes
// the API and revalidatePath — the refreshed rows flow back down as new props. On
// success the drawer closes and a toast confirms; on failure it stays open with the
// route's message inline. No client refetch, no duplicated authorization.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  Card, CardHeader, CardTitle, Table, THead, TH, TR, TD,
} from "@/components/shared/ui";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { reviewPortfolioRequestAction } from "@/app/branch-admin/portfolio-requests/actions";
import {
  STATUS_CONFIG, TYPE_LABELS, describeRequest, formatDate,
} from "@/components/worker-portfolio/request-types";
import { RequestDrawer } from "./request-drawer";
import { workerName, workerBranchName, type AdminRequestRow, type ReviewAction } from "./types";

export function RequestsView({
  requests,
  total,
  page,
  limit,
  totalPages,
}: {
  requests: AdminRequestRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = React.useState<AdminRequestRow | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function runReview(id: string, action: ReviewAction, note: string): Promise<string | null> {
    const res = await reviewPortfolioRequestAction(id, action, note);
    if (res.status === "success") {
      setSelected(null);
      setToast(res.message);
      return null;
    }
    return res.message;
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]"
        >
          <p className="flex items-center gap-2 text-xs text-gray-700 dark:text-[var(--sa-text-2)]">
            <Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />
            {toast}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{total} {total === 1 ? "request" : "requests"}</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Worker</TH>
              <TH>Employee code</TH>
              <TH>Request</TH>
              <TH>Branch</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {requests.map((r) => (
              <TR key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <WorkerAvatar
                      firstName={r.worker.firstName}
                      lastName={r.worker.lastName}
                      photo={r.worker.profilePhoto}
                      id={r.worker.id}
                      size={30}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-[var(--sa-text)]">{workerName(r.worker)}</p>
                      <p className="truncate text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">{r.worker.designation?.name ?? "—"}</p>
                    </div>
                  </div>
                </TD>
                <TD className="font-mono text-xs text-gray-600 dark:text-[var(--sa-muted)]">{r.worker.employeeCode}</TD>
                <TD className="text-gray-700 dark:text-[var(--sa-text-2)]">
                  {TYPE_LABELS[r.type]}
                  <span className="block max-w-50 truncate text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">
                    {describeRequest(r.type, r.payload)}
                  </span>
                </TD>
                <TD className="text-xs text-gray-500 dark:text-[var(--sa-muted)]">{workerBranchName(r.worker)}</TD>
                <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-[var(--sa-muted)]">{formatDate(r.createdAt)}</TD>
                <TD>
                  <Badge tone={STATUS_CONFIG[r.status].tone}>{STATUS_CONFIG[r.status].label}</Badge>
                </TD>
                <TD className="text-right">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                    className="text-xs font-medium text-gray-700 transition hover:text-gray-900 focus:outline-none focus:underline dark:text-[var(--sa-text-2)] dark:hover:text-[var(--sa-text)]"
                  >
                    {r.status === "PENDING" ? "Review" : "View"}
                  </button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-[var(--sa-border)] dark:text-[var(--sa-muted)]">
            <span>{from}–{to} of {total}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-40 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-40 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      <RequestDrawer request={selected} onClose={() => setSelected(null)} onReview={runReview} />
    </>
  );
}
