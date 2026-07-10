// Recent-activity timeline. Server-safe: items derived from real data upstream.
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StatusTone } from "./status-badge";

export type ActivityItem = {
  id: string;
  title: React.ReactNode;
  meta?: string;
  time?: string;
  href?: string;
  tone?: StatusTone;
  icon?: React.ComponentType<{ className?: string }>;
};

const ring: Record<StatusTone, string> = {
  neutral: "bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/5 dark:text-(--sa-text-2) dark:ring-white/10",
  success: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
  warning: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
  danger: "bg-red-50 text-red-500 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20",
  info: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
  accent: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="relative px-5 py-2">
      <span className="absolute left-[34px] top-4 bottom-4 w-px bg-gray-100 dark:bg-(--sa-border)" aria-hidden />
      {items.map((it) => {
        const Icon = it.icon;
        const body = (
          <div className="flex items-start gap-3 py-2.5">
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-(--sa-surface)",
                ring[it.tone ?? "neutral"],
                "ring-inset ring-1"
              )}
            >
              {Icon ? <Icon className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 dark:text-(--sa-text-2)">{it.title}</p>
              {it.meta && <p className="text-xs text-gray-400 dark:text-(--sa-muted)">{it.meta}</p>}
            </div>
            {it.time && <span className="shrink-0 text-xs text-gray-400 dark:text-(--sa-muted)">{it.time}</span>}
          </div>
        );
        return (
          <li key={it.id} className="relative">
            {it.href ? (
              <Link href={it.href} className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-gray-50 dark:hover:bg-(--sa-hover)">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
