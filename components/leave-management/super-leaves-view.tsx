"use client";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

// ============================================================================
// The interactive shell: branch-wise collapsible groups of leave cards, the review
// modal, pagination and the toast. Data arrives as props from the Server Component
// (fetched once, server-side, already branch-scoped) — this component never fetches
// the list. Approve / reject call the Server Action (PATCH status), which
// revalidates the page; the refreshed rows flow back down as props. An optimistic
// status override updates the badge the instant a decision lands, before the
// revalidation returns — so the UI never feels like it reloaded.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, X, ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setSuperLeaveStatusAction } from "@/app/super-admin/leaves/actions";
import { LeaveRequestCard } from "./leave-request-card";
import { ReviewModal } from "./review-modal";
import type { BranchLeave, LeaveStatus } from "@/components/branch-leaves/types";

type Group = { id: string; name: string; leaves: BranchLeave[] };

// Group the CURRENT page's leaves by the worker's primary active branch. Grouping is
// per-page (the API paginates globally); the branch filter narrows to one group.
function groupByBranch(leaves: BranchLeave[]): Group[] {
  const map = new Map<string, Group>();
  for (const l of leaves) {
    const links = l.worker.branches ?? [];
    const primary = links.find((b) => b.isPrimary) ?? links[0];
    const id = primary?.branch.id ?? "unassigned";
    const name = primary?.branch.name ?? "Unassigned";
    const g = map.get(id) ?? { id, name, leaves: [] };
    g.leaves.push(l);
    map.set(id, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function SuperLeavesView({
  leaves,
  total,
  page,
  limit,
  totalPages,
}: {
  leaves: BranchLeave[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = React.useState<BranchLeave | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [override, setOverride] = React.useState<Record<string, LeaveStatus>>({});
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Effective status = optimistic override (if any) over the server value.
  const statusOf = React.useCallback(
    (l: BranchLeave): LeaveStatus => override[l.id] ?? l.status,
    [override]
  );

  async function runStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<string | null> {
    const res = await setSuperLeaveStatusAction(id, status);
    if (res.status === "success") {
      setOverride((o) => ({ ...o, [id]: status })); // optimistic badge update
      setSelected(null);
      setToast(res.message);
      return null;
    }
    return res.message; // keep modal open, show inline
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = groupByBranch(leaves);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.id);
          return (
            <section key={g.id} className="rounded-lg border border-gray-200 bg-white">
              {/* Collapsible branch header */}
              <button
                type="button"
                onClick={() => toggle(g.id)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 text-gray-400" aria-hidden="true" />
                  <span className="text-sm font-semibold text-gray-900">{g.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{g.leaves.length}</span>
                </span>
                <ChevronDown className={cn("size-4 text-gray-400 transition-transform", isCollapsed && "-rotate-90")} aria-hidden="true" />
              </button>

              {!isCollapsed && (
                <div className="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {g.leaves.map((l) => (
                    <LeaveRequestCard key={l.id} leave={l} status={statusOf(l)} onOpen={() => setSelected(l)} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
          <span>{from}–{to} of {total}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <ReviewModal
        leave={selected}
        status={selected ? statusOf(selected) : "PENDING"}
        onClose={() => setSelected(null)}
        onApprove={(id) => runStatus(id, "APPROVED")}
        onReject={(id) => runStatus(id, "REJECTED")}
      />
    </>
  );
}
