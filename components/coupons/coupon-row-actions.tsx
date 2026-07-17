"use client";

// OWNER: Gauransh
// MODULE: Marketing — Coupon row actions
// PURPOSE: Per-coupon three-dot menu — View / Edit / Activate|Deactivate / Delete.
//          Deactivate and Activate flip only `isActive` (PATCH); Delete is the
//          backend's soft-delete (DELETE → isActive false). Rendered on the roles
//          the coupon routes allow (SUPER_ADMIN/OWNER/MARKETING_MANAGER).

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical, Eye, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CouponRow } from "./types";

const itemCls =
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-none transition select-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

export function CouponRowActions({
  coupon, onView, onEdit, onToggleActive, onDelete,
}: {
  coupon: CouponRow;
  onView: (c: CouponRow) => void;
  onEdit: (c: CouponRow) => void;
  onToggleActive: (c: CouponRow) => void;
  onDelete: (c: CouponRow) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Coupon actions" className="inline-flex size-8 items-center justify-center rounded text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10 data-[popup-open]:bg-gray-100 data-[popup-open]:text-gray-700">
        <MoreVertical className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-sm outline-none">
            <Menu.Item className={itemCls} onClick={() => onView(coupon)}><Eye className="size-3.5 text-gray-400" aria-hidden="true" /> View</Menu.Item>
            <Menu.Item className={itemCls} onClick={() => onEdit(coupon)}><Pencil className="size-3.5 text-gray-400" aria-hidden="true" /> Edit</Menu.Item>
            <Menu.Item className={itemCls} onClick={() => onToggleActive(coupon)}>
              {coupon.isActive ? <><PowerOff className="size-3.5 text-gray-400" aria-hidden="true" /> Deactivate</> : <><Power className="size-3.5 text-gray-400" aria-hidden="true" /> Activate</>}
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-gray-100" />
            <Menu.Item className={cn(itemCls, "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700")} onClick={() => onDelete(coupon)}><Trash2 className="size-3.5" aria-hidden="true" /> Delete</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
