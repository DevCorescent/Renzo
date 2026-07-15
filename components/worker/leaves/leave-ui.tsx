// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Leaves — presentational parts
//
// Pure, stateless building blocks: summary cards, the status badge, the loading
// skeletons and the empty state. No data fetching, no API calls — the orchestrator
// owns all of that and passes results in. Kept apart so the client component stays
// about behaviour and these stay about looks.
// ============================================================================

import * as React from "react";
import { CalendarPlus, CalendarDays } from "lucide-react";
import { Badge, Card } from "@/components/shared/ui";
import { STATUS_TONE, type LeaveRow, type LeaveStatus } from "./types";

/* ─── Status badge ───────────────────────────────────────────────────────────
 * A single source for status → colour, reused by the table so a status never
 * renders one colour in one place and another elsewhere.
 */
export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

/* ─── Summary cards ──────────────────────────────────────────────────────────
 * Derived entirely from the rows the orchestrator already holds — no extra
 * request. Because they read the same array the table does, they can never
 * disagree with it: apply or cancel mutates the array and both update together.
 */
export function SummaryCards({ rows }: { rows: LeaveRow[] }) {
  const total = rows.length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const approved = rows.filter((r) => r.status === "APPROVED").length;
  const rejected = rows.filter((r) => r.status === "REJECTED").length;

  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Total requests", value: total, tone: "text-gray-900" },
    { label: "Pending", value: pending, tone: "text-yellow-700" },
    { label: "Approved", value: approved, tone: "text-green-700" },
    { label: "Rejected", value: rejected, tone: "text-red-600" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{c.label}</p>
          <p className={`mt-2 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Skeletons ──────────────────────────────────────────────────────────────
 * Shown only on the FIRST load, while the rows are unknown. On refetch the real
 * rows are already on screen, so we never flash a skeleton over live content.
 */
function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ""}`} />;
}

export function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded border border-gray-200 bg-white p-4">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="mt-3 h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <Card aria-hidden="true">
      <div className="border-b border-gray-100 px-4 py-3">
        <Shimmer className="h-4 w-32" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="hidden h-4 w-40 sm:block" />
            <Shimmer className="ml-auto h-5 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────────
 * A real call to action, not a grey line of text. The button re-uses the same
 * handler the header button does, so there is one way to open the form.
 */
export function EmptyState({ onApply }: { onApply: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400"
      >
        <CalendarDays className="size-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">No leave requests yet</h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500">
        When you apply for leave it will show up here, along with its approval status.
      </p>
      <button
        type="button"
        onClick={onApply}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        Apply leave
      </button>
    </div>
  );
}
