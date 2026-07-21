"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave Management (table + drawer orchestrator)
//
// The interactive shell: the leave table, the row → detail drawer, pagination and
// the toast. Data arrives as props from the Server Component (fetched once, on the
// server) — this component never fetches the list itself.
//
// Approve / reject call the Server Actions, which POST to the API and
// revalidatePath the page; the refreshed rows and stats then flow back down as new
// props. On success the drawer closes and a toast confirms; on failure the drawer
// stays open with the route's own message inline. No client refetch, no duplicated
// authorization.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/shared/ui";
import { setLeaveStatusAction, grantLeaveAction } from "@/app/branch-admin/leaves/actions";
import { LeaveStatusBadge } from "./leaves-ui";
import { LeaveDrawer } from "./leave-drawer";
import { GrantLeaveModal } from "./grant-leave-modal";
import { formatDate, workerName, type BranchLeave, type LeaveTypeOption } from "./types";

export function LeavesView({
  leaves,
  total,
  page,
  limit,
  totalPages,
  leaveTypes = [],
}: {
  leaves: BranchLeave[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  leaveTypes?: LeaveTypeOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = React.useState<BranchLeave | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function runStatus(
    id: string,
    status: "APPROVED" | "REJECTED" | "PENDING"
  ): Promise<string | null> {
    const res = await setLeaveStatusAction(id, status);
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
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle>
              {total} {total === 1 ? "leave request" : "leave requests"}
            </CardTitle>
            {leaveTypes.length > 0 && (
              <GrantLeaveModal
                leaveTypes={leaveTypes}
                onGrant={async (input) => {
                  const res = await grantLeaveAction(input);
                  if (res.status === "success") {
                    setToast(res.message);
                    return null;
                  }
                  return res.message;
                }}
              />
            )}
          </div>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Worker</TH>
              <TH>Employee code</TH>
              <TH>Leave type</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Days</TH>
              <TH>Reason</TH>
              <TH>Status</TH>
              <TH>Applied</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {leaves.map((l) => (
              <TR
                key={l.id}
                className="cursor-pointer"
                onClick={() => setSelected(l)}
              >
                <TD className="font-medium text-gray-900 dark:text-[var(--sa-text)]">{workerName(l.worker)}</TD>
                <TD className="font-mono text-xs text-gray-600 dark:text-[var(--sa-muted)]">{l.worker.employeeCode}</TD>
                <TD className="text-gray-700 dark:text-[var(--sa-text-2)]">
                  {l.leaveType.name}
                  <span className="ml-1 text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">({l.leaveType.code})</span>
                </TD>
                <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-[var(--sa-text-2)]">{formatDate(l.startDate)}</TD>
                <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-[var(--sa-text-2)]">{formatDate(l.endDate)}</TD>
                <TD className="text-gray-500 dark:text-[var(--sa-muted)]">{l.days}</TD>
                <TD className="max-w-45 truncate text-xs text-gray-500 dark:text-[var(--sa-muted)]" title={l.reason}>
                  {l.reason}
                </TD>
                <TD>
                  <LeaveStatusBadge status={l.status} />
                </TD>
                <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-[var(--sa-muted)]">{formatDate(l.createdAt)}</TD>
                <TD className="text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      // Stop the row handler firing twice.
                      e.stopPropagation();
                      setSelected(l);
                    }}
                    className="text-xs font-medium text-gray-700 transition hover:text-gray-900 focus:outline-none focus:underline dark:text-[var(--sa-text-2)] dark:hover:text-[var(--sa-text)]"
                  >
                    {l.status === "PENDING" || l.status === "CANCELLED" ? "Review" : "View"}
                  </button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-[var(--sa-border)] dark:text-[var(--sa-muted)]">
            <span>
              {from}–{to} of {total}
            </span>
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

      <LeaveDrawer
        leave={selected}
        onClose={() => setSelected(null)}
        onApprove={(id) => runStatus(id, "APPROVED")}
        onReject={(id) => runStatus(id, "REJECTED")}
        onReopen={(id) => runStatus(id, "PENDING")}
      />
    </>
  );
}
