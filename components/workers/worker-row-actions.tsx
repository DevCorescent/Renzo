"use client";

// Per-row actions menu.
//
// Hand-rolled: no dropdown primitive is installed and adding Radix for one menu is
// not a trade worth making. Keyboard-operable (Escape closes and returns focus to
// the trigger), closes on outside click, carries the ARIA a screen reader needs.
//
// WHAT IS DELIBERATELY ABSENT, AND WHY
//   Attendance — /api/v1/admin has NO attendance endpoint, for any role.
//   Leave      — /api/v1/admin has NO leave endpoint, and no approve/reject route.
// A menu item that goes nowhere is worse than no menu item, so they are not
// rendered. Adding them later is a one-line change once those routes exist.

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import {
  deactivateWorkerAction,
  reactivateWorkerAction,
} from "@/app/branch-admin/workers/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

function StatusMenuItem({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      role="menuitem"
      disabled={pending}
      className={
        "block w-full px-3 py-1.5 text-left text-sm transition focus:outline-none disabled:opacity-50 " +
        (isActive
          ? "text-red-600 hover:bg-red-50 focus:bg-red-50"
          : "text-gray-700 hover:bg-gray-50 focus:bg-gray-50")
      }
    >
      {pending ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}

export function WorkerRowActions({
  workerId,
  basePath,
  workerName,
  isActive,
  canManage,
}: {
  workerId: string;
  /** Differs per role, so the caller supplies it. */
  basePath: string;
  workerName: string;
  isActive: boolean;
  /** False for read-only roles — the API would reject the write anyway. */
  canManage: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const [, statusAction] = useActionState(
    isActive ? deactivateWorkerAction : reactivateWorkerAction,
    IDLE_FORM_STATE
  );

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Focus must return to the trigger or a keyboard user is stranded.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Consolidated into ONE destination — the unified Worker Workspace, which holds
  // Overview / Portfolio / Schedule / Attendance / Leaves / Services / Performance /
  // Documents / Activity as tabs. The old per-page links (schedule, calendar, slots,
  // availability, services, shifts) are retired from this menu; those routes still
  // exist and are now reached from inside the workspace, not scattered here.
  const links = [{ label: "Open workspace", href: `${basePath}/${workerId}` }];

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${workerName}`}
        className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${workerName}`}
          className="absolute right-0 top-8 z-50 min-w-44 overflow-hidden rounded border border-gray-200 bg-white py-1 shadow-lg"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
            >
              {item.label}
            </Link>
          ))}

          {canManage && (
            <>
              <div className="my-1 border-t border-gray-100" role="separator" />
              <form action={statusAction} className="m-0">
                <input type="hidden" name="id" value={workerId} />
                <StatusMenuItem isActive={isActive} />
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
