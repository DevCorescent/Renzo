"use client";

// ============================================================================
// MODULE : Invoices — edit panel
//
// "Update details" corrects the bill itself: each line's quantity and unit
// price, the tip, the discount (₹ or %) and the notes, saved together as one
// edit. The figures shown before saving come from the server (dryRun), so the
// panel never re-implements the bill maths. Customer, payments, invoice number,
// date and GST are not editable.
//
// A PAID bill's figures can be corrected by roles that may refund (Branch Admin
// and above). If the corrected total is below what was collected, the server
// asks for the exact refund to be confirmed first; payments are never changed.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import { DiscountInput, discountFrom, type DiscountMode } from "@/components/operations/discount-input";

const round2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** What the server says the edit would produce (PATCH … dryRun: true). */
type Preview = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  refundRequired: number;
  requiresAdmin: boolean;
  changed: boolean;
};

const inputCls =
  "w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

type InvoiceItem = {
  id: string;
  name: string;
  type: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function InvoiceEditPanel({
  invoiceId,
  invoiceStatus,
  currentNotes,
  currentDiscount,
  subtotal,
  paidAmount = 0,
  canVoid,
  canCorrectPaid = false,
  items = [],
  customerId,
  customerBasePath,
}: {
  invoiceId: string;
  invoiceStatus: string;
  currentNotes: string | null;
  currentDiscount: number;
  /** Pre-tax subtotal — what a % discount is taken of. */
  subtotal: number;
  /** Collected minus refunded — the figure a corrected total is checked against. */
  paidAmount?: number;
  canVoid: boolean;
  /**
   * May change the discount on a PAID bill. The server refunds any excess over
   * the corrected total, so this is the roles that may refund (Branch Admin+).
   */
  canCorrectPaid?: boolean;
  items?: InvoiceItem[];
  customerId?: string;
  customerBasePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"edit" | "items" | "void">("edit");

  const serviceItems = items.filter((i) => i.type !== "TIP");
  const currentTip = round2(items.filter((i) => i.type === "TIP").reduce((sum, i) => sum + Number(i.total), 0));

  const [notes, setNotes] = React.useState(currentNotes ?? "");
  const [discount, setDiscount] = React.useState(String(currentDiscount));
  // Per line: quantity and unit price as typed.
  const [lines, setLines] = React.useState<Record<string, { qty: string; price: string }>>(() =>
    Object.fromEntries(serviceItems.map((i) => [i.id, { qty: String(i.quantity), price: String(i.unitPrice) }]))
  );
  const [tip, setTip] = React.useState(String(currentTip));
  // The server's answer for one edit, tagged with that edit so a reply for an
  // older set of inputs is never shown against newer ones.
  const [previewResult, setPreviewResult] = React.useState<
    { key: string; data: Preview | null; error: string | null } | null
  >(null);
  const [discountMode, setDiscountMode] = React.useState<DiscountMode>("AMOUNT");
  const [voidReason, setVoidReason] = React.useState("");

  // new item form
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("SERVICE");
  const [newQty, setNewQty] = React.useState("1");
  const [newPrice, setNewPrice] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // Set when the server says the corrected total is below what was collected:
  // the exact refund it will record, for the operator to confirm.
  const [refundDue, setRefundDue] = React.useState<{ amount: number; newTotal: number } | null>(null);
  const [refundMethod, setRefundMethod] = React.useState("CASH");

  const isPaid = invoiceStatus === "PAID";
  // Quantity, price, tip and discount: the same rule the server enforces.
  const canEditFigures =
    invoiceStatus === "UNPAID" || invoiceStatus === "PARTIAL" || (isPaid && canCorrectPaid);
  const canEditItems = invoiceStatus === "UNPAID" || invoiceStatus === "PARTIAL";
  const isVoided = invoiceStatus === "CANCELLED";

  /**
   * The edit as the server takes it, or the first thing wrong with it. The
   * subtotal is re-added from the edited lines (as the server rounds them) so a
   * % discount is a percentage of the NEW subtotal.
   */
  function buildEdit(): { edit: Record<string, unknown>; newSubtotal: number } | { error: string } {
    const changed: { id: string; quantity: number; unitPrice: number }[] = [];
    let newSubtotal = 0;
    for (const item of serviceItems) {
      const line = lines[item.id] ?? { qty: String(item.quantity), price: String(item.unitPrice) };
      const qty = Number(line.qty);
      const price = Number(line.price);
      if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
        return { error: `${item.name}: quantity must be a whole number from 1 to 999.` };
      }
      if (line.price.trim() === "" || !Number.isFinite(price) || price < 0) {
        return { error: `${item.name}: price must be a non-negative number.` };
      }
      newSubtotal += round2(price * qty);
      if (qty !== item.quantity || round2(price) !== round2(Number(item.unitPrice))) {
        changed.push({ id: item.id, quantity: qty, unitPrice: round2(price) });
      }
    }
    newSubtotal = round2(newSubtotal);

    const d = Number(discount || 0);
    if (!Number.isFinite(d) || d < 0) return { error: "Discount must be a non-negative number." };
    // discountFrom quietly caps at the subtotal (fine while raising a bill);
    // a correction to a saved one — possibly refunding money — is refused instead.
    if (discountMode === "PERCENT" ? d > 100 : d > newSubtotal) {
      return { error: "Discount cannot exceed the subtotal." };
    }
    const t = Number(tip || 0);
    if (!Number.isFinite(t) || t < 0) return { error: "Tip must be a non-negative number." };

    return {
      newSubtotal,
      edit: {
        // ₹ or % — the server always receives the rupee amount.
        discountAmount: discountFrom(discount, discountMode, newSubtotal),
        tipAmount: round2(t),
        ...(changed.length ? { items: changed } : {}),
      },
    };
  }

  const built = canEditFigures ? buildEdit() : null;
  const newSubtotal = built && "newSubtotal" in built ? built.newSubtotal : subtotal;
  const editKey = built && "edit" in built ? JSON.stringify(built.edit) : null;
  // A typing mistake is reported straight away; otherwise the server's preview
  // for exactly these inputs (none yet while it is being fetched).
  const current = editKey && previewResult?.key === editKey ? previewResult : null;
  const preview = current?.data ?? null;
  const previewError = built && "error" in built ? built.error : current?.error ?? null;

  // Live preview from the server, a moment after the last keystroke.
  React.useEffect(() => {
    if (!open || tab !== "edit" || !canEditFigures || !editKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(API.reception.editBill(invoiceId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true, edit: JSON.parse(editKey) }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          const fieldErrors = json?.errors
            ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
            : "";
          setPreviewResult({ key: editKey, data: null, error: fieldErrors || json?.message || "Could not work out the new total" });
          return;
        }
        setPreviewResult({ key: editKey, data: json.data as Preview, error: null });
      } catch {
        /* aborted by a newer keystroke, or offline — the save reports errors */
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, tab, canEditFigures, editKey, invoiceId]);

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
      if (res.status === 409 && typeof json?.data?.refundRequired === "number") {
        setRefundDue({ amount: json.data.refundRequired, newTotal: json.data.newTotal });
        setMsg({ tone: "err", text: json.message });
        return false;
      }
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

  async function handleSave(confirmRefund = false) {
    const body: Record<string, unknown> = { notes };
    if (canEditFigures) {
      const result = buildEdit();
      if ("error" in result) {
        setMsg({ tone: "err", text: result.error });
        return;
      }
      body.edit = result.edit;
    }
    if (confirmRefund && refundDue) {
      body.refund = { method: refundMethod, amount: refundDue.amount };
    }
    const ok = await patch(body);
    if (ok) {
      setRefundDue(null);
      setOpen(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    setRemovingId(itemId);
    setMsg(null);
    try {
      const res = await fetch(API.reception.editBill(invoiceId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeItemId: itemId }),
      });
      const json = await res.json().catch(() => null);
      setRemovingId(null);
      if (!res.ok || !json?.success) {
        setMsg({ tone: "err", text: json?.message || "Failed to remove item" });
        return;
      }
      setMsg({ tone: "ok", text: "Item removed" });
      router.refresh();
    } catch {
      setRemovingId(null);
      setMsg({ tone: "err", text: "Network error — please try again." });
    }
  }

  async function handleAddItem() {
    const qty = Number(newQty);
    const price = Number(newPrice);
    if (!newName.trim()) {
      setMsg({ tone: "err", text: "Enter a name for the item." });
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setMsg({ tone: "err", text: "Quantity must be at least 1." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setMsg({ tone: "err", text: "Price must be a non-negative number." });
      return;
    }
    const ok = await patch({ addItem: { name: newName.trim(), type: newType, quantity: qty, unitPrice: price } });
    if (ok) {
      setNewName("");
      setNewQty("1");
      setNewPrice("");
    }
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

  const tabs = [
    { key: "edit" as const, label: "Update details" },
    ...(canEditItems ? [{ key: "items" as const, label: "Edit services" }] : []),
    ...(canVoid ? [{ key: "void" as const, label: "Void invoice" }] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit invoice</CardTitle>
        <div className="flex items-center gap-2">
          {customerId && customerBasePath && (
            <a
              href={`${customerBasePath}/${customerId}`}
              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
            >
              Edit customer
            </a>
          )}
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); setMsg(null); setRefundDue(null); }}
            className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
          >
            {open ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            {open ? "Cancel" : "Edit"}
          </button>
        </div>
      </CardHeader>

      {!open && (
        <CardBody>
          <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
            {canEditItems
              ? "Edit quantities, prices, tip, discount and notes; add or remove services; or void this invoice."
              : isPaid && canCorrectPaid
                ? "Correct quantities, prices, tip, discount and notes, or void this invoice. Payments already recorded are kept."
                : "Update notes. A paid bill's figures can be corrected by a Branch Admin."}
          </p>
        </CardBody>
      )}

      {open && (
        <CardBody className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-gray-100 dark:border-(--sa-border)">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setMsg(null); }}
                className={`-mb-px px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                  tab === t.key
                    ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                    : "border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
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

          {/* Update details tab */}
          {tab === "edit" && (
            <div className="space-y-3">
              {canEditFigures && serviceItems.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">Services &amp; items</p>
                  <div className="overflow-x-auto rounded border border-gray-100 dark:border-(--sa-border)">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-[11px] text-gray-400 dark:border-(--sa-border)">
                          <th className="px-2 py-1.5 font-medium">Item</th>
                          <th className="w-20 px-2 py-1.5 font-medium">Qty</th>
                          <th className="w-28 px-2 py-1.5 font-medium">Unit price (₹)</th>
                          <th className="w-24 px-2 py-1.5 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceItems.map((item) => {
                          const line = lines[item.id] ?? { qty: String(item.quantity), price: String(item.unitPrice) };
                          const amount = round2(Number(line.price) * Number(line.qty));
                          const setLine = (patch: Partial<{ qty: string; price: string }>) => {
                            setLines((prev) => ({ ...prev, [item.id]: { ...line, ...patch } }));
                            setRefundDue(null);
                          };
                          return (
                            <tr key={item.id} className="border-b border-gray-50 last:border-0 dark:border-(--sa-border)">
                              <td className="px-2 py-1.5 text-gray-900 dark:text-(--sa-text)">{item.name}</td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number" min={1} max={999} step={1} inputMode="numeric"
                                  aria-label={`${item.name} quantity`}
                                  value={line.qty}
                                  onChange={(e) => setLine({ qty: e.target.value })}
                                  className={inputCls}
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number" min={0} step="0.01" inputMode="decimal"
                                  aria-label={`${item.name} unit price`}
                                  value={line.price}
                                  onChange={(e) => setLine({ price: e.target.value })}
                                  className={inputCls}
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-(--sa-text-2)">
                                {Number.isFinite(amount) ? inr(amount) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {canEditFigures && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <DiscountInput
                      id="edit-discount" raw={discount} mode={discountMode}
                      onRaw={(v) => { setDiscount(v); setRefundDue(null); }}
                      onMode={(m) => { setDiscountMode(m); setRefundDue(null); }}
                      subtotal={newSubtotal}
                      inputClassName={inputCls}
                    />
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">Taken off the subtotal before GST.</p>
                  </div>
                  <div>
                    <label htmlFor="edit-tip" className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                      Tip (₹)
                    </label>
                    <input
                      id="edit-tip" type="number" min={0} step="0.01" inputMode="decimal"
                      value={tip}
                      onChange={(e) => { setTip(e.target.value); setRefundDue(null); }}
                      className={inputCls}
                    />
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">Added after GST; never discounted.</p>
                  </div>
                </div>
              )}
              {canEditFigures && (previewError || preview?.changed) && (
                <div
                  aria-live="polite"
                  className={`rounded border px-3 py-2 text-xs ${
                    previewError
                      ? "border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                      : "border-gray-200 bg-gray-50 text-gray-700 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)"
                  }`}
                >
                  {previewError ? previewError : preview && (
                    <>
                      <p className="mb-1 font-medium text-gray-900 dark:text-(--sa-text)">After saving</p>
                      <p>
                        Subtotal {inr(preview.subtotal)} · Discount − {inr(preview.discountAmount)} · GST {inr(preview.taxAmount)}
                        {preview.tipAmount > 0 ? ` · Tip ${inr(preview.tipAmount)}` : ""}
                      </p>
                      <p className="mt-0.5 font-semibold text-gray-900 dark:text-(--sa-text)">
                        Total {inr(preview.totalAmount)} · Paid {inr(preview.paidAmount)}
                        {preview.refundRequired > 0
                          ? ` · Refund ${inr(preview.refundRequired)} to the customer`
                          : preview.balanceDue > 0 ? ` · Balance due ${inr(preview.balanceDue)}` : " · Fully paid"}
                      </p>
                      {preview.requiresAdmin && (
                        <p className="mt-1 text-amber-700 dark:text-amber-300">This change needs a Branch Admin or higher to save.</p>
                      )}
                    </>
                  )}
                </div>
              )}
              {canEditFigures && (
                <div>
                  {isPaid && (
                    <p className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      This invoice is paid (₹{paidAmount.toLocaleString("en-IN")} collected). If the corrected total is
                      lower, you will be asked to confirm a refund of the difference. Payments already recorded are kept.
                    </p>
                  )}
                </div>
              )}
              {refundDue && (
                <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    New total <strong>₹{refundDue.newTotal.toLocaleString("en-IN")}</strong>. Refund{" "}
                    <strong>₹{refundDue.amount.toLocaleString("en-IN")}</strong> to the customer — it is recorded
                    against this invoice and the paid amount drops by it.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="min-w-40">
                      <label htmlFor="edit-refund-method" className="mb-1 block text-[11px] font-medium text-amber-900 dark:text-amber-200">
                        Refund by
                      </label>
                      <select
                        id="edit-refund-method"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                        className={inputCls}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="ONLINE">Online</option>
                        <option value="WALLET">Wallet credit</option>
                      </select>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSave(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {busy && <Loader2 className="size-3.5 animate-spin" />}
                      Confirm refund &amp; save
                    </button>
                  </div>
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
                onClick={() => void handleSave()}
                disabled={busy || refundDue !== null}
                className="inline-flex items-center gap-1.5 rounded bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Save changes
              </button>
            </div>
          )}

          {/* Edit services tab */}
          {tab === "items" && canEditItems && (
            <div className="space-y-4">
              {/* Current items */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Current items</p>
                {serviceItems.length === 0 && (
                  <p className="text-xs text-gray-400">No items</p>
                )}
                {serviceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 dark:border-(--sa-border)">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900 dark:text-(--sa-text)">{item.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {item.quantity} × ₹{Number(item.unitPrice).toLocaleString("en-IN")} = ₹{Number(item.total).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={removingId === item.id}
                      onClick={() => handleRemoveItem(item.id)}
                      className="ml-3 shrink-0 rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                      title="Remove item"
                    >
                      {removingId === item.id
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Add item form */}
              <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3 dark:border-(--sa-border)">
                <p className="text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">Add item</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className={inputCls}
                      placeholder="Service / product name"
                    />
                  </div>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className={inputCls}
                  >
                    <option value="SERVICE">Service</option>
                    <option value="PRODUCT">Product</option>
                    <option value="ADDON">Add-on</option>
                    <option value="PACKAGE">Package</option>
                    <option value="MISC">Misc</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className={inputCls}
                    placeholder="Qty"
                  />
                  <div className="col-span-2 flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className={`${inputCls} flex-1`}
                      placeholder="Unit price (₹)"
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Void tab */}
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
