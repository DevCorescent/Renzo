"use client";

// OWNER: Gauransh
// MODULE: Membership Management (plan row actions)
// FLOW  : Per-plan three-dot menu — View (customers drawer), Edit (form), Delete
//         (confirm). Rendered only on the SUPER_ADMIN/OWNER page, the exact roles
//         the plan CRUD endpoints allow, so every item maps to a permitted action.
// ACCESS: SUPER_ADMIN, OWNER.

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanRow } from "./types";

const itemCls =
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-none transition select-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

export function PlanRowActions({
  plan, onView, onEdit, onDelete,
}: {
  plan: PlanRow;
  onView: (p: PlanRow) => void;
  onEdit: (p: PlanRow) => void;
  onDelete: (p: PlanRow) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Plan actions" className="inline-flex size-8 items-center justify-center rounded text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10 data-[popup-open]:bg-gray-100 data-[popup-open]:text-gray-700">
        <MoreVertical className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-36 rounded-md border border-gray-200 bg-white py-1 shadow-sm outline-none">
            <Menu.Item className={itemCls} onClick={() => onView(plan)}><Eye className="size-3.5 text-gray-400" aria-hidden="true" /> View</Menu.Item>
            <Menu.Item className={itemCls} onClick={() => onEdit(plan)}><Pencil className="size-3.5 text-gray-400" aria-hidden="true" /> Edit</Menu.Item>
            <Menu.Separator className="my-1 h-px bg-gray-100" />
            <Menu.Item className={cn(itemCls, "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700")} onClick={() => onDelete(plan)}><Trash2 className="size-3.5" aria-hidden="true" /> Delete</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
