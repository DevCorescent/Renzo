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
      {/* No `dark:` overrides on purpose: globals.css inverts the neutral ramp in
          dark mode, so bg-gray-900 / text-white already flip to a light pill with
          dark ink. The old `dark:bg-zinc-100 dark:text-zinc-900` pair rendered
          invisible — --color-zinc-100 is remapped to #1f1f23 (dark) while zinc-900
          is not remapped at all, so it was dark text on a dark pill. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
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
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 ring-1 ring-gray-200 transition-colors group-hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:ring-white/20 dark:group-hover:bg-white/20">
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
