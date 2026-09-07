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
import { ChevronDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
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
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";

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

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  // ── Search / filter ───────────────────────────────────────────────────────
  const [search, setSearch] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setBanner(null);
    setErrors({});

    try {
      const res = await fetch(API.admin.expenses, {
        method: "POST",
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
          ...(canChooseBranch && branchId ? { branchId } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) {
        setBanner(json?.message ?? "Could not record the expense.");
        setErrors(json?.errors ?? {});
        return;
      }

      setAmount("");
      setDescription("");
      setVendor("");
      setReferenceNo("");
      setCustomCategory("");
      router.refresh();
    } catch {
      setBusy(false);
      setBanner("Network error — please try again.");
    }
  }

  async function remove(id: string) {
    const res = await fetch(API.admin.expense(id), { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const fieldError = (name: string) =>
    errors[name]?.[0] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[name][0]}</p>
    ) : null;

  const needle = search.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter(
        (r) =>
          r.description.toLowerCase().includes(needle) ||
          (r.vendor ?? "").toLowerCase().includes(needle) ||
          (r.referenceNo ?? "").toLowerCase().includes(needle) ||
          expenseCategoryLabel(r.category, r.customCategory).toLowerCase().includes(needle) ||
          (r.branch?.name ?? "").toLowerCase().includes(needle)
      )
    : rows;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="h-fit">
        <CardHeader><CardTitle>Record an expense</CardTitle></CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            {banner && (
              <p className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {banner}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="exp-cat">Category</label>
                <Select id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{labelise(c)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className={labelCls} htmlFor="exp-amount">Amount ₹</label>
                <input id="exp-amount" type="number" min={0.01} step="0.01" required value={amount}
                  onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.00" />
                {fieldError("amount")}
              </div>
            </div>

            {category === "OTHERS" && (
              <div>
                <label className={labelCls} htmlFor="exp-custom-cat">Category name</label>
                <input id="exp-custom-cat" required minLength={2} maxLength={60} value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)} className={inputCls}
                  placeholder="Type the category" />
                {fieldError("customCategory")}
              </div>
            )}

            <div>
              <label className={labelCls} htmlFor="exp-desc">Description</label>
              <input id="exp-desc" required minLength={2} maxLength={200} value={description}
                onChange={(e) => setDescription(e.target.value)} className={inputCls}
                placeholder="e.g. July electricity bill" />
              {fieldError("description")}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="exp-date">Date</label>
                <input id="exp-date" type="date" max={today} value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)} className={inputCls} />
                {fieldError("expenseDate")}
              </div>
              <div>
                <label className={labelCls} htmlFor="exp-via">Paid via</label>
                <Select id="exp-via" value={paidVia} onChange={(e) => setPaidVia(e.target.value)}>
                  {EXPENSE_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{labelise(m)}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="exp-vendor">Vendor</label>
                <input id="exp-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}
                  className={inputCls} maxLength={120} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls} htmlFor="exp-ref">Bill / ref no.</label>
                <input id="exp-ref" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
                  className={inputCls} maxLength={60} placeholder="Optional" />
              </div>
            </div>

            {canChooseBranch && (
              <div>
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

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {busy ? "Saving…" : "Record expense"}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Expense history</CardTitle>
          <span className="text-xs text-gray-500 dark:text-(--sa-text-2)">
            {total} entr{total === 1 ? "y" : "ies"} · {formatMoney(filteredTotal)} total
          </span>
        </CardHeader>
        <div className="border-b border-gray-100 px-4 py-2 dark:border-(--sa-border)">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, vendor, category…"
              className="h-8 w-full rounded border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30"
            />
          </div>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Category</TH>
              <TH>Description</TH>
              <TH>Branch</TH>
              <TH>Paid via</TH>
              <TH>Amount</TH>
              <TH>Actions</TH>
            </tr>
          </THead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                  {needle ? `No expenses match "${search}".` : "No expenses recorded yet."}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatDate(row.expenseDate)}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <Badge tone="neutral">{expenseCategoryLabel(row.category, row.customCategory)}</Badge>
                  </TD>
                  <TD className="max-w-60">
                    <span className="block truncate text-sm text-gray-800 dark:text-(--sa-text)">
                      {row.description}
                    </span>
                    {(row.vendor || row.referenceNo) && (
                      <span className="block truncate text-[11px] text-gray-400 dark:text-(--sa-muted)">
                        {[row.vendor, row.referenceNo].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {row.branch?.name ?? "—"}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {labelise(row.paidVia)}
                  </TD>
                  <TD className={cn("whitespace-nowrap text-sm font-medium text-gray-900 dark:text-(--sa-text)")}>
                    {formatMoney(row.amount)}
                  </TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      aria-label={`Delete ${row.description}`}
                      className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
