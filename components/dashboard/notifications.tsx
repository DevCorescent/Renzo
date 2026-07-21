"use client";

// Notifications bell + popover.
//
// It now reads the user's REAL notification feed from the shared Notification
// Center API (GET /api/v1/notifications) — the single source every notify() write
// lands in — instead of only rendering whatever pseudo-items a page passed in. The
// dashboards used to derive `items` from recent appointments, so genuine
// notifications (portfolio approvals, appointment reschedules, …) never surfaced
// even though they were persisted correctly. Wiring the bell to the existing feed
// restores the whole pipeline for every role in one place, with no new service.
//
// The `items` prop is kept as the server-rendered seed so the first paint is never
// empty (and to preserve the existing call sites); the live feed replaces it after
// mount and on each open. Clicking still just navigates — no write is introduced.
import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import type { ApiResponse, PaginatedData } from "@/types/api";
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

// The Notification row shape the feed API returns (only the fields the bell shows).
type FeedNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
};

// NotificationType → the bell's dot tone. Mirrors the enum in schema.prisma; any
// unknown value falls back to neutral rather than throwing.
const TYPE_TONE: Record<string, StatusTone> = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "danger",
  SYSTEM: "neutral",
};

function toItem(n: FeedNotification): NotificationItem {
  return {
    id: n.id,
    title: n.title,
    meta: n.message,
    href: n.href ?? undefined,
    tone: TYPE_TONE[n.type] ?? "neutral",
    unread: n.readAt == null,
  };
}

/**
 * `items` is the server-rendered seed (first paint). The live API feed replaces it
 * after mount. Pass `dark` when rendering inside the customer portal (dark sidebar/header).
 */
export function Notifications({ items = [], dark = false }: { items?: NotificationItem[]; dark?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = useDismiss<HTMLDivElement>(() => setOpen(false));

  // The live feed, loaded from the shared Notification Center API. `null` until the
  // first load resolves, so the server-rendered `items` seed shows meanwhile.
  const [feed, setFeed] = React.useState<NotificationItem[] | null>(null);

  const load = React.useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch(`${API.notifications.list}?limit=10`, {
        signal,
        credentials: "include",
      });
      const body = (await res.json()) as ApiResponse<PaginatedData<FeedNotification>>;
      if (!res.ok || !body.success || !body.data) return;
      setFeed(body.data.items.map(toItem));
    } catch (e) {
      // A failed refresh leaves the last good feed (or the seed) in place — the bell
      // must never throw. AbortError is the expected teardown path.
      if ((e as Error)?.name === "AbortError") return;
    }
  }, []);

  // Load on mount (for the badge) and refresh whenever the popover opens, so the
  // Notification Center always reflects the latest persisted notifications.
  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => { await load(controller.signal); })();
    return () => controller.abort();
  }, [open, load]);

  const list = feed ?? items;
  const unread = list.filter((i) => i.unread).length;

  const buttonCls = dark
    ? "relative flex size-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-white/8 hover:text-stone-100"
    : "relative flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={buttonCls}
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
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Check className="size-5 text-gray-300 dark:text-(--sa-muted)" />
                  <p className="text-sm text-gray-400 dark:text-(--sa-muted)">You&apos;re all caught up</p>
                </div>
              ) : (
                list.map((n) => {
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
