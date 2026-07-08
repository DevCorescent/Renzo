// OWNER: Devanshi | Small presentational helpers for the customer portal.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/components/customer/data";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-card", className)}>{children}</div>
  );
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  CONFIRMED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CHECKED_IN: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  COMPLETED: "bg-primary/10 text-primary",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest",
        STATUS_STYLES[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
