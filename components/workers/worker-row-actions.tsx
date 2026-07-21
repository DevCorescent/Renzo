"use client";

// Per-row actions menu.
//
// Uses ReactDOM.createPortal to render the dropdown at document.body, avoiding
// overflow:hidden / overflow-x:auto clipping from the Card and Table wrappers.
// Position is computed from the trigger button's bounding rect and updated on
// scroll/resize so the menu tracks the button even inside scrollable containers.

import * as React from "react";
import { createPortal } from "react-dom";
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
  basePath: string;
  workerName: string;
  isActive: boolean;
  canManage: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const [, statusAction] = useActionState(
    isActive ? deactivateWorkerAction : reactivateWorkerAction,
    IDLE_FORM_STATE
  );

  function updatePos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  React.useEffect(() => {
    if (!open) { setMenuPos(null); return; }
    updatePos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    // Reposition when any ancestor scrolls (capture phase catches nested
    // overflow containers like the Table's overflow-x-auto wrapper).
    const onScroll = () => updatePos();
    const onResize = () => updatePos();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const links = [{ label: "Open workspace", href: `${basePath}/${workerId}` }];

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${workerName}`}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="min-w-44 overflow-hidden rounded border border-gray-200 bg-white py-1 shadow-lg"
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative flex justify-end">
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

      {menu}
    </div>
  );
}
