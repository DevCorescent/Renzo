"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — tab shell
//
// The single enterprise page for a worker: one header, one tab bar, one source of
// truth. All read-only panels render from the data already fetched on the server
// (no per-tab query); only Schedule fetches lazily, because it is computed. Tab
// state is local — switching tabs never re-hits the server, since everything is
// already loaded.
//
// The old scattered actions (Profile / Schedule / Calendar / Slots / Availability /
// Services / Shifts) are consolidated here; the 3-dot menu now opens this one page.
// ============================================================================

import * as React from "react";
import { cn } from "@/lib/utils";
import type { WorkerWorkspaceData } from "@/lib/worker-workspace";
import {
  OverviewTab, PortfolioTab, AttendanceTab, LeavesTab, ServicesTab, PerformanceTab, DocumentsTab, ActivityTab,
} from "./workspace-tabs";
import { ScheduleTab } from "./schedule-tab";

const TABS = [
  "Overview", "Portfolio", "Schedule", "Attendance", "Leaves", "Services", "Performance", "Documents", "Activity",
] as const;
type Tab = (typeof TABS)[number];

export function Workspace({
  data,
  includeOverview = true,
}: {
  data: WorkerWorkspaceData;
  includeOverview?: boolean;
}) {
  const tabs = React.useMemo<readonly Tab[]>(
    () => (includeOverview ? TABS : TABS.filter((tab) => tab !== "Overview")),
    [includeOverview]
  );
  const [active, setActive] = React.useState<Tab>(
    includeOverview ? "Overview" : "Portfolio"
  );
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Roving-tabindex keyboard support: ←/→ move between tabs, Home/End jump to ends.
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    let next = index;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setActive(tabs[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Worker workspace" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-[var(--sa-border)]">
        {tabs.map((tab, i) => {
          const selected = active === tab;
          return (
            <button
              key={tab}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`ws-tab-${tab}`}
              aria-selected={selected}
              aria-controls={`ws-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-[var(--sa-hover)]",
                selected
                  ? "border-gray-900 text-gray-900 dark:border-[var(--sa-text)] dark:text-[var(--sa-text)]"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-[var(--sa-text-2)] dark:hover:text-[var(--sa-text)]"
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`ws-panel-${active}`} aria-labelledby={`ws-tab-${active}`} className="pt-5">
        {active === "Overview" && <OverviewTab data={data} />}
        {active === "Portfolio" && <PortfolioTab data={data} />}
        {active === "Schedule" && <ScheduleTab workerId={data.worker.id} />}
        {active === "Attendance" && <AttendanceTab data={data} />}
        {active === "Leaves" && <LeavesTab data={data} />}
        {active === "Services" && <ServicesTab data={data} />}
        {active === "Performance" && <PerformanceTab data={data} />}
        {active === "Documents" && <DocumentsTab data={data} />}
        {active === "Activity" && <ActivityTab data={data} />}
      </div>
    </div>
  );
}
