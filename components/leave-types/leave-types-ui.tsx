// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Types (admin) — presentational parts
//
// Pure building blocks: the five summary cards, the paid & status badges, the
// on/off toggle, the loading skeletons and the empty state. No fetching — the
// orchestrator owns all of that.
// ============================================================================

import * as React from "react";
import { CalendarOff, Plus } from "lucide-react";
import { Badge, Card } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import type { LeaveType } from "./types";

/* ─── Summary cards ─────────────────────────────────────────────────────────
 * Computed from the full catalog the orchestrator holds, so they always match
 * the table even as it is searched, filtered or paged (those only affect what is
 * shown, never the underlying set the cards count).
 */
export function SummaryCards({ all }: { all: LeaveType[] }) {
  const total = all.length;
  const active = all.filter((t) => t.isActive).length;
  const paid = all.filter((t) => t.isPaid).length;

  const cards = [
    { label: "Total types", value: total, tone: "text-gray-900" },
    { label: "Active", value: active, tone: "text-green-700" },
    { label: "Inactive", value: total - active, tone: "text-gray-500" },
    { label: "Paid", value: paid, tone: "text-blue-700" },
    { label: "Unpaid", value: total - paid, tone: "text-amber-700" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{c.label}</p>
          <p className={cn("mt-2 text-2xl font-semibold", c.tone)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Badges ─────────────────────────────────────────────────────────────── */
export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return <Badge tone={isPaid ? "info" : "warning"}>{isPaid ? "Paid" : "Unpaid"}</Badge>;
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Inactive"}</Badge>;
}

/* ─── Toggle ─────────────────────────────────────────────────────────────────
 * A real switch: role, aria-checked, keyboard-operable as a <button>. No toggle
 * primitive is installed, and this one is small enough not to warrant a dependency.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-gray-900/15 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-gray-900" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow transition",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* ─── Skeletons ────────────────────────────────────────────────────────────── */
function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-gray-100", className)} />;
}

export function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded border border-gray-200 bg-white p-4">
          <Shimmer className="h-3 w-16" />
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
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-5 w-14" />
            <Shimmer className="h-5 w-16" />
            <Shimmer className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─── Empty states ───────────────────────────────────────────────────────────
 * Two shapes: nothing exists yet (call to action) vs a filter matched nothing
 * (offer to clear). The orchestrator picks which by whether the catalog is empty.
 */
export function EmptyCatalog({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400"
      >
        <CalendarOff className="size-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">No leave types yet</h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500">
        Create the leave types your staff can request — Casual, Sick, Unpaid, and so on.
        Workers can only apply for the ones marked active.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      >
        <Plus className="size-4" aria-hidden="true" />
        New leave type
      </button>
    </div>
  );
}

export function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
      <h3 className="text-sm font-semibold text-gray-900">No leave types match your filters</h3>
      <p className="mt-1 text-xs text-gray-500">Try a different search or clear the filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex h-9 items-center rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        Clear filters
      </button>
    </div>
  );
}
