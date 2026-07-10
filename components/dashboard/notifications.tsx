"use client";

// Notifications bell + popover. Presentational: items are passed in (derived from
// real data server-side) — clicking one just navigates. No mutation / API writes.
import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "./use-dismiss";
import type { StatusTone } from "./status-badge";

export type NotificationItem = {
  id: string;
  title: string;
  meta?: string;
  href?: string;
  tone?: StatusTone;
  unread?: boolean;
};

const dotTone: Record<StatusTone, string> = {
  neutral: "bg-gray-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  accent: "bg-amber-500",
};

export function Notifications({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false));
  const unread = items.filter((i) => i.unread).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)"
      >
        <Bell className="size-4.5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-2 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-(--sa-surface)" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-(--sa-border) dark:bg-(--sa-elevated) dark:shadow-black/40"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-(--sa-border)">
              <p className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">Notifications</p>
              {unread > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                  {unread} new
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Check className="size-5 text-gray-300 dark:text-(--sa-muted)" />
                  <p className="text-sm text-gray-400 dark:text-(--sa-muted)">You&apos;re all caught up</p>
                </div>
              ) : (
                items.map((n) => {
                  const Wrapper = n.href ? Link : "div";
                  return (
                    <Wrapper
                      key={n.id}
                      href={n.href ?? "#"}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 border-b border-gray-50 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-(--sa-hover)"
                    >
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotTone[n.tone ?? "neutral"])} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-800 dark:text-(--sa-text)">{n.title}</span>
                        {n.meta && <span className="block text-xs text-gray-400 dark:text-(--sa-muted)">{n.meta}</span>}
                      </span>
                      {n.unread && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" />}
                    </Wrapper>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
