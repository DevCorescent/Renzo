"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory (UI) — adjust stock
//
// A manual stock adjustment through the EXISTING, now branch-scoped endpoint
// POST /api/v1/admin/inventory/stock/adjust. That route runs applyStockMovement
// inside a transaction, so the Stock row AND the StockMovement audit entry are
// written atomically — this UI never touches stock directly, and never trusts a
// branchId of its own (the API pins a Branch Admin to their session branch).
//
// Controlled, inline validation: a bad field turns red on its own and nothing else
// is lost. On success it router.refresh()es so the table AND the summary cards
// recompute from the server — no manual state juggling, no stale numbers.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import type { ApiEnvelope, StockRow } from "./types";

// Types a human may book by hand (PURCHASE_IN / TRANSFER_* belong to the receive
// and transfer flows). Outbound-only ones can never ADD stock.
const TYPES = [
  { value: "ADJUSTMENT", label: "Correction (add or remove)", outboundOnly: false },
  { value: "DAMAGE", label: "Damage", outboundOnly: true },
  { value: "EXPIRY", label: "Expiry", outboundOnly: true },
  { value: "SERVICE_USE", label: "Service use", outboundOnly: true },
  { value: "RETAIL_SALE", label: "Retail sale", outboundOnly: true },
] as const;

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

export function AdjustStockModal({
  row,
  onClose,
  onDone,
}: {
  row: StockRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = row !== null;

  const [type, setType] = React.useState("ADJUSTMENT");
  const [direction, setDirection] = React.useState<"add" | "remove">("remove");
  const [qty, setQty] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const outboundOnly = TYPES.find((t) => t.value === type)?.outboundOnly ?? false;

  // Reset on open — render-phase reset keyed on the shown row (the pattern the
  // project's lint rule requires over a state-setting effect).
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && row.id !== shownId) {
    setShownId(row.id);
    setType("ADJUSTMENT");
    setDirection("remove");
    setQty("");
    setNotes("");
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && shownId !== null) {
    setShownId(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row || submitting) return;

    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setErrors({ qty: ["Enter a quantity greater than zero"] });
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);

    // Outbound types always remove; correction respects the chosen direction.
    const delta = outboundOnly || direction === "remove" ? -n : n;

    let payload: ApiEnvelope<unknown>;
    try {
      const res = await fetch(API.admin.stockAdjust, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // branchId is the row's branch. The API ignores it for a Branch Admin
        // (forced to their session branch) and honours it for a global role
        // adjusting a specific branch's stock — either way, never trusted blindly.
        body: JSON.stringify({ productId: row.productId, branchId: row.branchId, type, delta, notes: notes.trim() || undefined }),
      });
      payload = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !payload.success) {
        setErrors(payload.errors ?? {});
        setFormError(payload.errors ? null : payload.message || "Could not adjust stock");
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    // Re-run the server component → table rows and summary cards both refresh.
    router.refresh();
    onDone("Stock adjusted");
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!submitting) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !submitting) onClose(); }}
      aria-labelledby="adjust-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {row && (
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="adjust-title" className="truncate text-sm font-semibold text-gray-900">Adjust stock — {row.product.name}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{row.branch.name} · on hand {row.quantity} {row.product.unit}</p>
            </div>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            <div className="space-y-1">
              <label htmlFor="adj-type" className="block text-xs font-medium text-gray-700">Reason</label>
              <select id="adj-type" value={type} onChange={(e) => { setType(e.target.value); if (TYPES.find((t) => t.value === e.target.value)?.outboundOnly) setDirection("remove"); }} disabled={submitting} className={inputCls}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Direction</label>
                <div className="inline-flex h-9 w-full overflow-hidden rounded border border-gray-200">
                  {(["add", "remove"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={submitting || (outboundOnly && d === "add")}
                      onClick={() => setDirection(d)}
                      className={cn(
                        "flex-1 text-xs font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-40",
                        direction === d ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="adj-qty" className="block text-xs font-medium text-gray-700">Quantity<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></label>
                <input id="adj-qty" type="number" min={0} step="any" value={qty} onChange={(e) => { setQty(e.target.value); setErrors({}); }} disabled={submitting} aria-invalid={Boolean(errors.qty)} className={cn(inputCls, errors.qty && invalidCls)} />
                {errors.qty?.map((m) => <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>)}
                {errors.delta?.map((m) => <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>)}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="adj-notes" className="block text-xs font-medium text-gray-700">Notes</label>
              <input id="adj-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} placeholder="Optional" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={submitting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Saving…" : "Apply adjustment"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
