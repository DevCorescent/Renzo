// Presentational primitives for the Workers module. Server Components.
//
// Deliberately small. Every column the list can render is bounded by the explicit
// `select` in GET /api/v1/admin/workers — there is no live status, utilisation or
// today's-appointment count in that response, so there are no components for them
// here. Inventing the UI first and hoping the data appears is how a dashboard ends
// up rendering zeros with confidence.

import Image from "next/image";
import { cn } from "@/lib/utils";

/* ─── Avatar ───────────────────────────────────────────────────────────────── */
// profilePhoto is nullable in the schema and most workers have none, so initials
// are the primary path, not the fallback.

const AVATAR_TINTS = [
  "bg-slate-100 text-slate-600",
  "bg-stone-100 text-stone-600",
  "bg-zinc-100 text-zinc-600",
  "bg-neutral-100 text-neutral-600",
] as const;

export function WorkerAvatar({
  firstName,
  lastName,
  photo,
  id,
  size = 36,
}: {
  firstName: string;
  lastName: string;
  photo: string | null;
  id: string;
  size?: number;
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  // Deterministic tint from the id, so the same worker keeps the same colour
  // across pages and the eye can track them down a long list.
  const tint =
    AVATAR_TINTS[
      [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TINTS.length
    ];

  if (photo) {
    return (
      <Image
        src={photo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-[var(--sa-border)]"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-gray-200 dark:ring-[var(--sa-border)]",
        tint
      )}
    >
      {initials || "—"}
    </span>
  );
}

/* ─── Empty state ──────────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="mb-3 flex size-10 items-center justify-center rounded-full bg-gray-50 ring-1 ring-gray-100 dark:bg-[var(--sa-tile)] dark:ring-[var(--sa-border)]"
      >
        <span className="text-gray-300 dark:text-[var(--sa-muted)]">—</span>
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-[var(--sa-text)]">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-gray-400 dark:text-[var(--sa-muted)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
