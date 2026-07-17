"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddItemModal } from "./add-item-modal";
import type { Option } from "./types";

// The page's top-right primary action. Reuses the shared Button (black, h-10) rather
// than restyling one, and owns the Add Item modal + its success toast. Category /
// supplier / branch option lists are passed down from the Server Component so the
// modal never fetches them itself.
export function AddItemButton({
  categories,
  suppliers,
  branches,
  isSuperAdmin,
  fixedBranchId,
}: {
  categories: Option[];
  suppliers: Option[];
  branches: Option[];
  isSuperAdmin: boolean;
  /** Inventory Manager's own branch — forwarded to the modal so a GLOBAL-scoped
   *  manager's new stock lands in their branch (the backend cannot pin it). */
  fixedBranchId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" /> Add Item
      </Button>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
          <Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <AddItemModal
        open={open}
        onClose={() => setOpen(false)}
        onDone={(m) => { setOpen(false); setToast(m); }}
        categories={categories}
        suppliers={suppliers}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
        fixedBranchId={fixedBranchId}
      />
    </>
  );
}
