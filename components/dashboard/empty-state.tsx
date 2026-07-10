// Empty state — icon in a soft tile, message, and optional action. Server-safe.
import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-gray-200/70 dark:bg-white/5 dark:ring-(--sa-border)">
        <Icon className="size-5 text-gray-400 dark:text-(--sa-muted)" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-900 dark:text-(--sa-text)">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-(--sa-text-2)">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
