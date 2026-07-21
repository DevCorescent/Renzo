"use client";

// Per-row actions menu.
//
// Hand-rolled: no dropdown primitive is installed and adding Radix for one menu is
// not a trade worth making. Keyboard-operable (Escape closes and returns focus to
// the trigger), closes on outside click, carries the ARIA a screen reader needs.
//
// WHY THE MENU IS PORTALLED
//   The row lives inside a `Card` with `overflow-hidden` AND the shared `Table`'s
//   `overflow-x-auto` wrapper (which, per CSS, also clips the y-axis). An
//   absolutely-positioned menu is therefore CLIPPED by those ancestors — and since
//   a branch usually has only a handful of workers, every row sits near the table's
//   bottom edge, so the menu opened in state but was scissored out of view and
//   appeared to "never open". Rendering the menu into a document.body portal, with
//   fixed positioning anchored to the trigger, lets it escape every clipping/scroll
//   ancestor while staying visually and behaviourally identical. Being under <html>
//   it also inherits the global light/dark/system theme automatically.
//
// WHAT IS DELIBERATELY ABSENT, AND WHY
//   Attendance — /api/v1/admin has NO attendance endpoint, for any role.
//   Leave      — /api/v1/admin has NO leave endpoint, and no approve/reject route.
// A menu item that goes nowhere is worse than no menu item, so they are not
// rendered. Adding them later is a one-line change once those routes exist.

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MoreHorizontal, LayoutGrid, UserX, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deactivateWorkerAction,
  reactivateWorkerAction,
} from "@/app/branch-admin/workers/actions";
import { IDLE_FORM_STATE } from "@/lib/form-state";

// Shared menu-item shape, matched to the ERP's canonical dropdown (the account menu
// in dashboard-header): flex row, icon + label on one baseline, equal height/padding,
// inset rounded hover, and the same light/dark tokens — so every item lines up and
// the menu reads identically to the rest of the app in all three themes.
const MENU_ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";
const MENU_ITEM_NEUTRAL =
  "text-gray-700 hover:bg-gray-50 focus:bg-gray-50 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)";
const MENU_ITEM_DANGER =
  "text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10";
const MENU_ICON = "size-4 shrink-0 text-gray-400 dark:text-(--sa-muted)";

// Fixed-position anchor for the portalled menu, right-aligned to the trigger to
// match the original design. `bottom` is used when the menu is flipped above.
type MenuAnchor = { top?: number; bottom?: number; right: number };

// Rough menu height used only to decide which way to open near a viewport edge.
const MENU_ESTIMATED_HEIGHT = 160;
const MENU_GAP = 6;

function StatusMenuItem({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  const Icon = isActive ? UserX : UserCheck;

  return (
    <button
      type="submit"
      role="menuitem"
      disabled={pending}
      className={cn(
        MENU_ITEM,
        "disabled:opacity-50",
        isActive ? MENU_ITEM_DANGER : MENU_ITEM_NEUTRAL
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", isActive ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-(--sa-muted)")}
        aria-hidden="true"
      />
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
  const [anchor, setAnchor] = React.useState<MenuAnchor | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const [, statusAction] = useActionState(
    isActive ? deactivateWorkerAction : reactivateWorkerAction,
    IDLE_FORM_STATE
  );

  // Anchor the fixed menu to the trigger's current viewport rect. Flips above when
  // there is not enough room below (last rows, short viewports, mobile). Called from
  // the click handler and, while open, from scroll/resize listeners — never
  // synchronously inside an effect body.
  const placeMenu = React.useCallback((): MenuAnchor | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const right = Math.max(MENU_GAP, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < MENU_ESTIMATED_HEIGHT && rect.top > spaceBelow;
    return openAbove
      ? { right, bottom: window.innerHeight - rect.top + MENU_GAP }
      : { right, top: rect.bottom + MENU_GAP };
  }, []);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      // Compute position in the event handler (not an effect) so the menu paints in
      // the right place on the very first frame — no flash at 0,0.
      if (next) setAnchor(placeMenu());
      return next;
    });
  }

  React.useEffect(() => {
    if (!open) return;

    // Outside click closes — the trigger AND the portalled menu both count as
    // "inside", so clicking a menu item is never mistaken for an outside click.
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Focus must return to the trigger or a keyboard user is stranded.
      triggerRef.current?.focus();
    };

    // Keep the fixed menu pinned to the trigger while the page scrolls or resizes
    // (capture=true also catches scrolling inner containers like the table wrapper).
    const reposition = () => setAnchor(placeMenu());

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, placeMenu]);

  // Consolidated into ONE destination — the unified Worker Workspace, which holds
  // Overview / Portfolio / Schedule / Attendance / Leaves / Services / Performance /
  // Documents / Activity as tabs. The old per-page links (schedule, calendar, slots,
  // availability, services, shifts) are retired from this menu; those routes still
  // exist and are now reached from inside the workspace, not scattered here.
  const links = [{ label: "Open workspace", href: `${basePath}/${workerId}` }];

  return (
    <div className="flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${workerName}`}
        className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {/* Portalled to <body> so no overflow/scroll ancestor can clip it. Rendered
          only client-side while open, so there is no server/client hydration diff. */}
      {open && anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${workerName}`}
            style={{ position: "fixed", ...anchor }}
            className="z-50 min-w-44 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-(--sa-border) dark:bg-(--sa-elevated) dark:shadow-black/40"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(MENU_ITEM, MENU_ITEM_NEUTRAL)}
              >
                <LayoutGrid className={MENU_ICON} aria-hidden="true" />
                {item.label}
              </Link>
            ))}

            {canManage && (
              <>
                <div className="my-1 h-px bg-gray-100 dark:bg-(--sa-border)" role="separator" />
                {/* Menu stays open through the submit so StatusMenuItem's "Working…"
                    pending state is visible; the action revalidates the list on done. */}
                <form action={statusAction}>
                  <input type="hidden" name="id" value={workerId} />
                  <StatusMenuItem isActive={isActive} />
                </form>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
