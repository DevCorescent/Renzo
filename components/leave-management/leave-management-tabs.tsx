"use client";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The renamed "Leave Management" area holds two things: the leave-request dashboard
// (new) and the existing Leave Types configuration (unchanged). This tab bar links
// them so the single nav entry can reach both — the Leave Types page keeps working
// exactly as before, now just surfaced as a tab.
const TABS = [
  { label: "Requests", href: "/super-admin/leaves" },
  { label: "Leave Types", href: "/super-admin/leave-types" },
] as const;

export function LeaveManagementTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
