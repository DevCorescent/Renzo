// Premium surface primitives for the dashboard. Server-safe.
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Base card: soft shadow, subtle ring, rounded-xl. */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)] transition-colors duration-300 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-(--sa-border)", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 dark:bg-white/5 dark:text-(--sa-text-2) dark:ring-(--sa-border)">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{title}</h3>
          {subtitle && <p className="truncate text-xs text-gray-500 dark:text-(--sa-text-2)">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** "View all →" style link used in card headers. */
export function ViewAllLink({ href, children = "View all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)"
    >
      {children}
      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

/** Card built around a chart: header + padded body. */
export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </Panel>
  );
}
