// Streamed while a single worker's workspace loads. Renders inside the shared
// dashboard theme root (#sa-dash-root) with DashThemeInit so the skeleton already
// wears the active theme — without it, navigating from the roster would flash the
// light list-shaped skeleton before the dark detail page landed. The shape mirrors
// the real detail layout (hero + KPI grid + two cards + workspace section) so the
// page does not jump when data arrives.

import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";
import { DashThemeInit } from "@/components/dashboard/dash-theme-init";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 dark:bg-white/10 ${className}`} />;
}

export default function Loading() {
  return (
    <div
      id={THEME_ROOT_ID}
      suppressHydrationWarning
      className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <DashThemeInit />
      <span className="sr-only">Loading worker…</span>

      <div className="space-y-5">
        <Bar className="h-3 w-28" />

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-2">
            {/* Hero */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
              <div className="flex flex-col gap-5 sm:flex-row">
                <Bar className="size-26 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <Bar className="h-6 w-52" />
                  <Bar className="h-3.5 w-32" />
                  <Bar className="h-3 w-40" />
                  <Bar className="mt-2 h-3 w-full max-w-md" />
                </div>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
                  <Bar className="h-2.5 w-20" />
                  <Bar className="mt-3 h-6 w-12" />
                  <Bar className="mt-2 h-2.5 w-10" />
                </div>
              ))}
            </div>

            {/* Two cards */}
            <div className="grid gap-5 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
                  <div className="border-b border-gray-100 px-5 py-3.5 dark:border-(--sa-border)">
                    <Bar className="h-3.5 w-36" />
                  </div>
                  <div className="space-y-3 p-5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Bar key={j} className="h-3.5 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail */}
          <aside className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
                <Bar className="h-3.5 w-32" />
                <div className="mt-4 space-y-2.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Bar key={j} className="h-3 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </aside>
        </div>

        {/* Workspace section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none">
          <Bar className="h-4 w-32" />
          <Bar className="mt-2 h-3 w-72" />
          <Bar className="mt-5 h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
