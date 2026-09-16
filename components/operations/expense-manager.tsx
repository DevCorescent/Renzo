"use client";

// ============================================================================
// MODULE : Manual Operations — branch expenses
//
// Record what the branch spent, and list it back with a running total. Posts to
// /admin/expenses, which is branch-scoped by requireBranchScope — a branch admin
// books against their own branch and cannot name another's.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Badge, Card, CardBody, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  expenseCategoryLabel,
  formatMoney,
  labelise,
} from "@/lib/operations";

export type ExpenseRow = {
  id: string;
  category: string;
  customCategory: string | null;
  amount: number;
  expenseDate: string;
  description: string;
  paidVia: string;
  vendor: string | null;
  referenceNo: string | null;
  branch: { id: string; name: string } | null;
};

export type BranchOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
// Native selects crowd their text and arrow against the right edge. Drop the OS
// arrow, leave room on the right for our own chevron, and keep the label off it.
const selectCls = cn(inputCls, "cursor-pointer appearance-none pr-9");

/** A <select> styled to match inputs, with a chevron that clears the edge. */
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={selectCls}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-(--sa-text-2)" />
    </div>
  );
}
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";
const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-(--sa-ink) dark:text-(--sa-bg) dark:hover:opacity-90";
// Row action buttons — a comfortable 32px hit target with a visible outline.
const iconBtn =
  "inline-flex size-8 items-center justify-center rounded border border-gray-200 text-gray-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-(--sa-border) dark:text-(--sa-text-2)";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
}

export function ExpenseManager({
  rows,
  total,
  filteredTotal,
  branches,
  canChooseBranch,
}: {
  rows: ExpenseRow[];
  total: number;
  filteredTotal: number;
  branches: BranchOption[];
  canChooseBranch: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [category, setCategory] = React.useState<string>("MISCELLANEOUS");
  const [customCategory, setCustomCategory] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [expenseDate, setExpenseDate] = React.useState(today);
  const [description, setDescription] = React.useState("");
  const [paidVia, setPaidVia] = React.useState("CASH");
  const [vendor, setVendor] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [branchId, setBranchId] = React.useState("");

  // When set, the form edits this expense instead of recording a new one.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLDivElement>(null);

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  // Floating confirmation after a record / edit / delete. No toast library is
  // installed, so this follows the same local pattern as the other screens.
  const [toast, setToast] = React.useState<{ text: string; ok: boolean } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Search / filter ───────────────────────────────────────────────────────
  const [search, setSearch] = React.useState("");

  function resetForm() {
    setEditingId(null);
    setCategory("MISCELLANEOUS");
    setCustomCategory("");
    setAmount("");
    setExpenseDate(today);
    setDescription("");
    setPaidVia("CASH");
    setVendor("");
    setReferenceNo("");
    setBanner(null);
    setErrors({});
  }

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setCategory(row.category);
    setCustomCategory(row.customCategory ?? "");
    setAmount(String(row.amount));
    setExpenseDate(row.expenseDate.slice(0, 10));
    setDescription(row.description);
    setPaidVia(row.paidVia);
    setVendor(row.vendor ?? "");
    setReferenceNo(row.referenceNo ?? "");
    setBanner(null);
    setErrors({});
    // On narrower screens the form is stacked above the table — bring it into view.
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setBanner(null);
    setErrors({});

    try {
      const res = await fetch(editingId ? API.admin.expense(editingId) : API.admin.expenses, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          customCategory: category === "OTHERS" ? customCategory.trim() : null,
          amount: Number(amount),
          expenseDate,
          description: description.trim(),
          paidVia,
          vendor: vendor.trim() || null,
          referenceNo: referenceNo.trim() || null,
          ...(!editingId && canChooseBranch && branchId ? { branchId } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) {
        setBanner(json?.message ?? (editingId ? "Could not update the expense." : "Could not record the expense."));
        setErrors(json?.errors ?? {});
        return;
      }

      setToast({ text: editingId ? "Changes saved" : "Expense added", ok: true });
      if (editingId) {
        resetForm();
      } else {
        setAmount("");
        setDescription("");
        setVendor("");
        setReferenceNo("");
        setCustomCategory("");
      }
      router.refresh();
    } catch {
      setBusy(false);
      setBanner("Network error — please try again.");
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(API.admin.expense(id), { method: "DELETE" });
      if (res.ok) {
        if (id === editingId) resetForm();
        setToast({ text: "Expense deleted", ok: true });
        router.refresh();
      } else {
        setToast({ text: "Could not delete the expense", ok: false });
      }
    } catch {
      setToast({ text: "Network error — please try again", ok: false });
    }
  }

  const fieldError = (name: string) =>
    errors[name]?.[0] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[name][0]}</p>
    ) : null;

  // Search every column the user can see — date, category, description, vendor,
  // ref no., branch, payment method and amount. Each word must match somewhere,
  // so "upi khana" narrows to UPI khana entries.
  const needle = search.trim().toLowerCase();
  const tokens = needle.split(/\s+/).filter(Boolean);
  const visibleRows = React.useMemo(() => {
    if (tokens.length === 0) return rows;
    return rows.filter((r) => {
      const haystack = [
        formatDate(r.expenseDate),
        r.expenseDate.slice(0, 10),
        expenseCategoryLabel(r.category, r.customCategory),
        r.description,
        r.vendor,
        r.referenceNo,
        r.branch?.name,
        labelise(r.paidVia),
        String(r.amount),
        formatMoney(r.amount),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      // "2000" should find ₹2,000 — compare with separators stripped too.
      const bare = haystack.replace(/[₹,]/g, "");
      return tokens.every((t) => haystack.includes(t) || bare.includes(t.replace(/[₹,]/g, "")));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, needle]);

  const isFiltering = tokens.length > 0;
  const shownCount = isFiltering ? visibleRows.length : total;
  const shownTotal = isFiltering ? visibleRows.reduce((sum, r) => sum + Number(r.amount), 0) : filteredTotal;

  return (
    // The form sits beside the table only on very wide screens; below that it
    // stacks on top and spreads its fields across the full width instead.
    <div className="grid gap-4 2xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card
        ref={formRef}
        className={cn(
          "@container h-fit min-w-0 scroll-mt-4 transition-colors",
          editingId && "border-amber-300 dark:border-amber-400/40"
        )}
      >
        <CardHeader>
          <div>
            <CardTitle>{editingId ? "Edit expense" : "Record an expense"}</CardTitle>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-muted)">
              {editingId ? "Update the details and save." : "Add a bill or payment made by the branch."}
            </p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} aria-label="Cancel editing" title="Cancel editing"
              className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-3.5 @2xl:grid-cols-4">
            {banner && (
              <p className="col-span-full rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {banner}
              </p>
            )}

            <div className="col-span-2 @2xl:col-span-1">
              <label className={labelCls} htmlFor="exp-cat">Category</label>
              <Select id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{labelise(c)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className={labelCls} htmlFor="exp-amount">Amount (₹)</label>
              <input id="exp-amount" type="number" min={0.01} step="0.01" required value={amount}
                onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.00" />
              {fieldError("amount")}
            </div>
            <div>
              <label className={labelCls} htmlFor="exp-date">Date</label>
              <input id="exp-date" type="date" required max={today} value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)} className={inputCls} />
              {fieldError("expenseDate")}
            </div>
            <div className="col-span-2 @2xl:col-span-1">
              <label className={labelCls} htmlFor="exp-via">Paid via</label>
              <Select id="exp-via" value={paidVia} onChange={(e) => setPaidVia(e.target.value)}>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{labelise(m)}</option>
                ))}
              </Select>
            </div>

            {category === "OTHERS" && (
              <div className="col-span-2">
                <label className={labelCls} htmlFor="exp-custom-cat">Category name</label>
                <input id="exp-custom-cat" required minLength={2} maxLength={60} value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)} className={inputCls}
                  placeholder="Type the category" />
                {fieldError("customCategory")}
              </div>
            )}

            <div className="col-span-2">
              <label className={labelCls} htmlFor="exp-desc">Description</label>
              <input id="exp-desc" required minLength={2} maxLength={200} value={description}
                onChange={(e) => setDescription(e.target.value)} className={inputCls}
                placeholder="e.g. July electricity bill" />
              {fieldError("description")}
            </div>

            <div>
              <label className={labelCls} htmlFor="exp-vendor">
                Vendor <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(optional)</span>
              </label>
              <input id="exp-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}
                className={inputCls} maxLength={120} placeholder="e.g. Tata Power" />
            </div>
            <div>
              <label className={labelCls} htmlFor="exp-ref">
                Bill / ref no. <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(optional)</span>
              </label>
              <input id="exp-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
                className={inputCls} maxLength={60} placeholder="e.g. INV-1042" />
            </div>

            {canChooseBranch && !editingId && (
              <div className="col-span-2">
                <label className={labelCls} htmlFor="exp-branch">Branch</label>
                <Select id="exp-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                  <option value="">Choose a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
                {fieldError("branchId")}
              </div>
            )}

            <div className="col-span-full flex gap-2 pt-1 @2xl:justify-end">
              {editingId && (
                <button type="button" onClick={resetForm} disabled={busy} className={cn(btnGhost, "flex-1 @2xl:flex-none")}>
                  Cancel
                </button>
              )}
              <button type="submit" disabled={busy} className={cn(btnPrimary, "flex-1 @2xl:flex-none")}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingId ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {busy ? "Saving…" : editingId ? "Save changes" : "Record expense"}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Expense history</CardTitle>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-muted)">
              {isFiltering
                ? rows.length < total
                  ? `${shownCount} match in the latest ${rows.length} of ${total} entries`
                  : `${shownCount} of ${total} entries match`
                : `${total} entr${total === 1 ? "y" : "ies"}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
              {isFiltering ? "Total (filtered)" : "Total spent"}
            </p>
            <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">
              {formatMoney(shownTotal)}
            </p>
          </div>
        </CardHeader>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-(--sa-border)">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              inputMode="search"
              aria-label="Search expenses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
              }}
              placeholder="Search by description, category, vendor, amount, date, UPI…"
              className="h-9 w-full rounded border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                title="Clear search"
                className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-(--sa-text)"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Category</TH>
              <TH>Description</TH>
              {canChooseBranch && <TH>Branch</TH>}
              <TH>Paid via</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={canChooseBranch ? 7 : 6} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                  {needle ? `No expenses match "${search}".` : "No expenses recorded yet."}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <TR
                  key={row.id}
                  className={cn(row.id === editingId && "bg-amber-50 hover:bg-amber-50 dark:bg-amber-400/10 dark:hover:bg-amber-400/10")}
                >
                  <TD className="whitespace-nowrap text-sm tabular-nums text-gray-600 dark:text-(--sa-text-2)">
                    {formatDate(row.expenseDate)}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <Badge tone="neutral" className="px-2.5 py-1 text-xs">
                      {expenseCategoryLabel(row.category, row.customCategory)}
                    </Badge>
                  </TD>
                  <TD className="max-w-64">
                    <span className="block truncate text-sm font-medium text-gray-800 dark:text-(--sa-text)">
                      {row.description}
                    </span>
                    {(row.vendor || row.referenceNo) && (
                      <span className="block truncate text-xs text-gray-400 dark:text-(--sa-muted)">
                        {[row.vendor, row.referenceNo].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </TD>
                  {canChooseBranch && (
                    <TD className="whitespace-nowrap text-sm text-gray-500 dark:text-(--sa-text-2)">
                      {row.branch?.name ?? "—"}
                    </TD>
                  )}
                  <TD className="whitespace-nowrap text-sm text-gray-500 dark:text-(--sa-text-2)">
                    {labelise(row.paidVia)}
                  </TD>
                  <TD className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">
                    {formatMoney(row.amount)}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={`Edit ${row.description}`}
                        title="Edit"
                        className={cn(iconBtn, "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-400")}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${row.description}"?`)) void remove(row.id);
                        }}
                        aria-label={`Delete ${row.description}`}
                        title="Delete"
                        className={cn(iconBtn, "hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400")}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-6 right-6 z-100 flex items-center gap-2.5 rounded-lg border bg-white px-4 py-3 shadow-lg dark:bg-(--sa-surface)",
            toast.ok ? "border-emerald-200 dark:border-emerald-500/30" : "border-red-200 dark:border-red-500/30"
          )}
        >
          {toast.ok ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <X className="size-4 text-red-600 dark:text-red-400" aria-hidden="true" />
          )}
          <p className="text-sm font-medium text-gray-800 dark:text-(--sa-text)">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="ml-1 rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
