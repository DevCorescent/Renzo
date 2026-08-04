"use client";

// ============================================================================
// MODULE : Attendance — section navigation
//
// Records / Calendar / Reports (and Shifts, where the role may author them).
// Takes a base path so the same component serves /super-admin/attendance and
// /branch-admin/attendance without either hardcoding the other's URLs.
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BarChart3, Clock, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

export function AttendanceTabs({
  basePath,
  shiftsPath,
}: {
  /** e.g. "/super-admin/attendance". */
  basePath: string;
  /** Rendered only for roles that may manage shift templates. */
  shiftsPath?: string;
}) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { label: "Records", href: basePath, icon: Table2 },
    { label: "Calendar", href: `${basePath}/calendar`, icon: CalendarDays },
    { label: "Reports", href: `${basePath}/reports`, icon: BarChart3 },
    ...(shiftsPath ? [{ label: "Shifts", href: shiftsPath, icon: Clock }] : []),
  ];

  return (
    <nav
      aria-label="Attendance sections"
      className="flex flex-wrap items-center gap-1 border-b border-gray-200 dark:border-(--sa-border)"
    >
      {tabs.map((tab) => {
        // Exact match only: /attendance must not light up while on /attendance/calendar.
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
              active
                ? "border-gray-900 font-medium text-gray-900 dark:border-white dark:text-(--sa-text)"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-(--sa-text-2) dark:hover:text-(--sa-text)"
            )}
          >
            <tab.icon className="size-3.5" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
