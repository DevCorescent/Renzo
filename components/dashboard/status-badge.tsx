// Status pill with a reserved semantic palette + a leading dot, so state is never
// conveyed by colour alone. Server-safe (no client hooks).
import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const styles: Record<StatusTone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10", dot: "bg-gray-400" },
  success: { wrap: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/25", dot: "bg-emerald-500" },
  warning: { wrap: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/25", dot: "bg-amber-500" },
  danger: { wrap: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/25", dot: "bg-red-500" },
  info: { wrap: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/25", dot: "bg-sky-500" },
  accent: { wrap: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30", dot: "bg-amber-500" },
};

export function StatusBadge({
  children,
  tone = "neutral",
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  const s = styles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        s.wrap,
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />}
      {children}
    </span>
  );
}

/** Maps common domain statuses to a tone so pages don't repeat the mapping. */
const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: "success",
  COMPLETED: "success",
  CONFIRMED: "success",
  PAID: "success",
  PENDING: "warning",
  PARTIAL: "warning",
  CHECKED_IN: "info",
  STARTED: "info",
  RESCHEDULED: "info",
  INACTIVE: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  REFUNDED: "danger",
};

export function statusTone(value: string): StatusTone {
  return STATUS_TONES[value?.toUpperCase?.()] ?? "neutral";
}
