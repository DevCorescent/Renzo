"use client";

// Quick Actions button + popover menu. Pure navigation via next/link — no API.
import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useDismiss } from "./use-dismiss";

export type QuickAction = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
};

export function QuickActions({ actions, label = "Quick actions" }: { actions: QuickAction[]; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-white/25"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-(--sa-border) dark:bg-(--sa-elevated) dark:shadow-black/40"
          >
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-(--sa-hover)"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 transition-colors group-hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20 dark:group-hover:bg-amber-500/20">
                  <a.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-(--sa-text)">{a.label}</span>
                  {a.description && <span className="block truncate text-xs text-gray-400 dark:text-(--sa-muted)">{a.description}</span>}
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
