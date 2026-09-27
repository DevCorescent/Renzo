"use client";

// ============================================================================
// MODULE : Invoice — inline edit panel
//
// Rendered on the billing detail page. Lets admins:
//   • Update notes on any invoice
//   • Change discount on UNPAID / PARTIAL invoices (recalculates totals)
//   • Void / cancel an invoice (BRANCH_ADMIN / OWNER / SUPER_ADMIN only)
//
// PATCH /api/v1/reception/billing/[id]
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";

const inputCls =
  "w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

export function InvoiceEditPanel({
  invoiceId,
  invoiceStatus,
  currentNotes,
  currentDiscount,
  canVoid,
}: {
  invoiceId: string;
  invoiceStatus: string;
  currentNotes: string | null;
  currentDiscount: number;
  /** True for BRANCH_ADMIN / OWNER / SUPER_ADMIN */
  canVoid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"edit" | "void">("edit");

  const [notes, setNotes] = React.useState(currentNotes ?? "");
  const [discount, setDiscount] = React.useState(String(currentDiscount));
  const [voidReason, setVoidReason] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const canEditDiscount = invoiceStatus === "UNPAID" || invoiceStatus === "PARTIAL";
  const isVoided = invoiceStatus === "CANCELLED";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(API.reception.editBill(invoiceId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);
      if (!res.ok || !json?.success) {
        const fieldErrors = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
          : "";
        setMsg({ tone: "err", text: fieldErrors || json?.message || "Update failed" });
        return false;
      }
      setMsg({ tone: "ok", text: json.message || "Saved" });
      router.refresh();
      return true;
    } catch {
      setBusy(false);
      setMsg({ tone: "err", text: "Network error — please try again." });
      return false;
    }
  }

  async function handleSave() {
    const body: Record<string, unknown> = { notes };
    if (canEditDiscount) {
      const d = Number(discount);
      if (!Number.isFinite(d) || d < 0) {
        setMsg({ tone: "err", text: "Discount must be a non-negative number." });
        return;
      }
      body.discountAmount = d;
    }
    const ok = await patch(body);
    if (ok) setOpen(false);
  }

  async function handleVoid() {
    if (!voidReason.trim()) {
      setMsg({ tone: "err", text: "Enter a reason for voiding." });
      return;
    }
    const ok = await patch({ void: true, voidReason: voidReason.trim() });
    if (ok) setOpen(false);
  }

  if (isVoided) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit invoice</CardTitle>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setMsg(null); }}
          className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
        >
          {open ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
          {open ? "Cancel" : "Edit"}
        </button>
      </CardHeader>

      {!open && (
        <CardBody>
          <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
            {canEditDiscount
              ? "Update discount, notes, or void this invoice."
              : "Update notes or void this invoice. Discount cannot be changed on a paid invoice."}
          </p>
        </CardBody>
      )}

      {open && (
        <CardBody className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-100 dark:border-(--sa-border)">
            {(["edit", "void"] as const)
              .filter((t) => t !== "void" || canVoid)
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setMsg(null); }}
                  className={`-mb-px px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                    tab === t
                      ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                      : "border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {t === "edit" ? "Update details" : "Void invoice"}
                </button>
              ))}
          </div>

          {msg && (
            <p className={`rounded border px-3 py-2 text-xs ${
              msg.tone === "ok"
                ? "border-green-100 bg-green-50 text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
            }`}>
              {msg.text}
            </p>
          )}

          {tab === "edit" && (
            <div className="space-y-3">
              {canEditDiscount && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className={inputCls}
                    placeholder="0"
                  />
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                    Totals and balance are recalculated immediately.
                  </p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputCls} resize-none`}
                  placeholder="Internal notes, payment details, any remarks…"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Save changes
              </button>
            </div>
          )}

          {tab === "void" && canVoid && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Voiding marks the invoice as cancelled and cannot be undone. Payments already collected are <strong>not</strong> automatically refunded — issue a refund separately if needed.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                  Reason for voiding *
                </label>
                <input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Duplicate invoice, wrong customer…"
                  maxLength={300}
                />
              </div>
              <button
                type="button"
                onClick={handleVoid}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Void this invoice
              </button>
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}
