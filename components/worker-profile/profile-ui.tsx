// ============================================================================
// OWNER  : Hemant | MODULE: Worker — Profile
//
// Shared presentational primitives for the internal profile: a labelled field, a
// section shell and small formatters. Reuses the shared Card family so the profile
// speaks the same design language as the rest of the panel. No interactivity —
// this is a read-only record.
// ============================================================================

import * as React from "react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

/* ─── Section shell ──────────────────────────────────────────────────────────
 * A titled card with an optional icon and a right-aligned slot (a badge, a link).
 * Every section wears the same frame so the page reads as one coherent record.
 */
export function ProfileSection({
  title,
  icon: Icon,
  action,
  children,
  bodyClassName,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-gray-400 dark:text-(--sa-muted)" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardBody className={bodyClassName}>{children}</CardBody>
    </Card>
  );
}

/* ─── Field ──────────────────────────────────────────────────────────────────
 * One labelled value. Never renders undefined/null — a missing value collapses to
 * an em dash so a card can never show "null".
 */
export function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  const isEmpty =
    value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

  return (
    <div className={cn("rounded-lg border border-gray-100 bg-gray-50/40 p-3 dark:border-(--sa-border) dark:bg-white/5", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-800 dark:text-(--sa-text)">{isEmpty ? "—" : value}</dd>
    </div>
  );
}

/** A responsive grid of Fields. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

/** ISO/Date → "12 Jul 2026", UTC-pinned so a date never rolls back a day. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
