// ============================================================================
// MODULE : Manual Operations — the hub
//
// Super Admin, Branch Admin and Reception render the SAME hub; they differ only
// in the capabilities their role carries and the path prefix their links resolve
// against. The card list is `operationsFor(caps)`, so a role is never shown a
// door it cannot open.
//
// Server Component: counters are loaded on the server, scoped by requireBranchScope.
// ============================================================================

import Link from "next/link";
import {
  UserPlus,
  CalendarPlus,
  CalendarClock,
  ClipboardList,
  Users,
  Receipt,
  ShoppingBag,
  Wallet,
  Crown,
  Gift,
  Percent,
  Undo2,
  Banknote,
  Sparkles,
  UserCheck,
  Boxes,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { Card, PageHeader } from "@/components/shared/ui";
import { OperationsSearch } from "@/components/operations/operations-search";
import {
  OPERATION_GROUPS,
  formatMoney,
  operationHref,
  operationsFor,
  type OperationKey,
  type OperationsCapability,
} from "@/lib/operations";
import type { OperationsSummary } from "@/lib/operations-service";

/** One icon per operation. Kept beside the hub, not in the catalogue, so the
 *  catalogue stays a plain data module usable from the server without React. */
const OPERATION_ICON: Record<OperationKey, React.ComponentType<{ className?: string }>> = {
  customer: UserPlus,
  walkIn: Sparkles,
  appointment: CalendarPlus,
  advanceBooking: CalendarClock,
  serviceOrder: ClipboardList,
  staffAssignment: Users,
  billing: Receipt,
  productSale: ShoppingBag,
  payment: Wallet,
  membership: Crown,
  giftCard: Gift,
  coupon: Percent,
  refund: Undo2,
  expense: Banknote,
  loyalty: Sparkles,
  attendance: UserCheck,
  staff: Users,
  inventory: Boxes,
  health: ClipboardCheck,
};

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className="p-3.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
        {label}
      </p>
      <p
        className={
          tone === "warning"
            ? "mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400"
            : "mt-1 text-xl font-semibold text-gray-900 dark:text-(--sa-text)"
        }
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-(--sa-muted)">{hint}</p>
      )}
    </Card>
  );
}

export function OperationsHub({
  capability,
  summary,
  basePath,
  branchLabel,
  attendanceApprovalHref,
}: {
  capability: OperationsCapability;
  summary: OperationsSummary;
  /** e.g. "/reception" — every relative operation resolves against this. */
  basePath: string;
  branchLabel: string;
  /** Where "pending approvals" sends a role that can approve. */
  attendanceApprovalHref: string | null;
}) {
  const available = operationsFor(capability);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Operations"
        subtitle={`Every manual action in one place — ${branchLabel}.`}
      />

      <OperationsSearch basePath={basePath} />

      {/* ── Today ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Walk-ins" value={String(summary.walkInsToday)} />
          <StatTile
            label="Manual appointments"
            value={String(summary.manualAppointments)}
            hint="Walk-in, phone or WhatsApp"
          />
          <StatTile label="New customers" value={String(summary.manualCustomers)} hint="Entered by staff" />
          <StatTile label="Bills raised" value={String(summary.manualBills)} />
          <StatTile label="Collected" value={formatMoney(summary.manualRevenue)} />
          <StatTile label="Expenses" value={formatMoney(summary.expensesToday)} />
          <StatTile label="Manual attendance" value={String(summary.manualAttendance)} />
          {attendanceApprovalHref ? (
            <Link href={attendanceApprovalHref} className="block">
              <StatTile
                label="Pending approvals"
                value={String(summary.pendingApprovals)}
                hint={summary.pendingApprovals > 0 ? "Needs review →" : "All clear"}
                tone={summary.pendingApprovals > 0 ? "warning" : "default"}
              />
            </Link>
          ) : (
            <StatTile
              label="Pending approvals"
              value={String(summary.pendingApprovals)}
              tone={summary.pendingApprovals > 0 ? "warning" : "default"}
            />
          )}
        </div>
      </section>

      {/* ── Operations, grouped ───────────────────────────────────────────── */}
      {OPERATION_GROUPS.map((group) => {
        const ops = available.filter((op) => op.group === group);
        if (ops.length === 0) return null;

        return (
          <section key={group}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
              {group}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ops.map((op) => {
                const Icon = OPERATION_ICON[op.key];
                return (
                  <Link
                    key={op.key}
                    href={operationHref(op, basePath)}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:hover:border-white/25"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition group-hover:bg-gray-900 group-hover:text-white dark:bg-white/10 dark:text-(--sa-text-2) dark:group-hover:bg-white dark:group-hover:text-gray-900">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                        {op.label}
                        <ArrowRight
                          className="size-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-(--sa-text-2)">
                        {op.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
        Every action here writes through the same rules as the automated flow — the same
        conflict checks, stock movements, loyalty accrual and audit trail. A walk-in and an
        online booking are indistinguishable in the reports.
      </p>
    </div>
  );
}
