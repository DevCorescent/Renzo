"use client";

// OWNER: Gauransh
// MODULE: Services & Categories Management

import * as React from "react";
import { cn } from "@/lib/utils";

export type TabDef = { id: string; label: string; content: React.ReactNode };

// A minimal, design-consistent tab strip. Only the ACTIVE tab's content is rendered,
// so an inactive panel neither mounts nor fetches until selected. Switching tabs is
// pure client state — no navigation, no reload.
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = React.useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-[var(--sa-border)]">
        {tabs.map((t) => {
          const isActive = t.id === current?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                isActive ? "border-gray-900 text-gray-900 dark:border-white dark:text-[var(--sa-text)]" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-[var(--sa-muted)] dark:hover:text-[var(--sa-text-2)]"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
