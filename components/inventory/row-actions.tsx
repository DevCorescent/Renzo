"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical, Eye, Pencil, SlidersHorizontal, History, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockRow } from "./types";

// The per-row three-dot menu. It only RENDERS actions the backend actually supports
// for the current role — Edit / Delete mutate the (global) Product record, which the
// existing RBAC restricts to global roles, so they are shown only when `canManage`
// is true. This is UX gating; the API remains the source of truth.
const itemCls =
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-none transition select-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

export function RowActions({
  row,
  canManage,
  onView,
  onAdjust,
  onHistory,
  onEdit,
  onDelete,
}: {
  row: StockRow;
  canManage: boolean;
  onView: (row: StockRow) => void;
  onAdjust: (row: StockRow) => void;
  onHistory: (row: StockRow) => void;
  onEdit: (row: StockRow) => void;
  onDelete: (row: StockRow) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Row actions"
        className="inline-flex size-8 items-center justify-center rounded text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10 data-[popup-open]:bg-gray-100 data-[popup-open]:text-gray-700"
      >
        <MoreVertical className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-sm outline-none">
            <Menu.Item className={itemCls} onClick={() => onView(row)}>
              <Eye className="size-3.5 text-gray-400" aria-hidden="true" /> View details
            </Menu.Item>
            {canManage && (
              <Menu.Item className={itemCls} onClick={() => onEdit(row)}>
                <Pencil className="size-3.5 text-gray-400" aria-hidden="true" /> Edit item
              </Menu.Item>
            )}
            <Menu.Item className={itemCls} onClick={() => onAdjust(row)}>
              <SlidersHorizontal className="size-3.5 text-gray-400" aria-hidden="true" /> Adjust stock
            </Menu.Item>
            <Menu.Item className={itemCls} onClick={() => onHistory(row)}>
              <History className="size-3.5 text-gray-400" aria-hidden="true" /> Stock history
            </Menu.Item>
            {canManage && (
              <>
                <Menu.Separator className="my-1 h-px bg-gray-100" />
                <Menu.Item
                  className={cn(itemCls, "text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700")}
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> Deactivate
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
