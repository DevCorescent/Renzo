"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";

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
  canVoid,
  items = [],
  customerId,
  customerBasePath,
}: {
  invoiceId: string;
  invoiceStatus: string;
  currentNotes: string | null;
  currentDiscount: number;
  canVoid: boolean;
  items?: InvoiceItem[];
  customerId?: string;
  customerBasePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"edit" | "items" | "void">("edit");

  const [notes, setNotes] = React.useState(currentNotes ?? "");
  const [discount, setDiscount] = React.useState(String(currentDiscount));
  const [voidReason, setVoidReason] = React.useState("");

  // new item form
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("SERVICE");
  const [newQty, setNewQty] = React.useState("1");
  const [newPrice, setNewPrice] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const canEditDiscount = invoiceStatus === "UNPAID" || invoiceStatus === "PARTIAL";
  const canEditItems = invoiceStatus === "UNPAID" || invoiceStatus === "PARTIAL";
  const isVoided = invoiceStatus === "CANCELLED";

  const serviceItems = items.filter((i) => i.type !== "TIP");

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
            onClick={() => { setOpen((v) => !v); setMsg(null); }}
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
              ? "Edit services, discount, notes, or void this invoice."
              : "Update notes or void this invoice. Services and discount cannot be changed on a paid invoice."}
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
