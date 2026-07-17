"use client";

// OWNER: Gauransh
// MODULE: Services & Categories Management

// ============================================================================
// Categories tab — REUSES the existing category endpoints only:
//   list   → GET    /api/v1/admin/services/categories  (search + pagination params)
//   create → POST   /api/v1/admin/services/categories
//   edit   → PATCH  /api/v1/admin/services/categories/[id]
//   delete → DELETE /api/v1/admin/services/categories/[id]
// Slug is derived by the backend from the name and never sent. A blocked delete
// (services still reference the category → 409) shows the backend message and keeps
// the confirm open. Mutations render only when `canManage` is true; the backend
// restricts category writes to super/owner, so a Branch Admin sees a read-only table
// (they may still list categories) — no action is offered that the API would reject.
// ============================================================================

import * as React from "react";
import { Plus, Pencil, Trash2, X, Check, Search, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { GENDERS, formatDate, type ApiEnvelope, type CategoryRow, type Gender, type Paginated } from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type FormState = { name: string; description: string; gender: Gender; sortOrder: string; isActive: boolean };

export function CategoriesPanel({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = React.useState<CategoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");

  const [toast, setToast] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CategoryRow | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounced backend search (one request per pause; reset to page 1).
  React.useEffect(() => {
    if (term === committedSearch) return;
    const t = setTimeout(() => { setCommittedSearch(term); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, committedSearch]);

  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (committedSearch.trim()) params.set("search", committedSearch.trim());
      try {
        const res = await fetch(`${API.admin.categories}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<CategoryRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items);
          setTotal(json.data.total);
          setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load categories");
          setRows([]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Could not reach the server. Please try again.");
        setRows([]);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [page, committedSearch, reloadKey]);

  function afterMutation(message: string, removed = false) {
    setToast(message);
    if (removed && rows.length === 1 && page > 1) setPage((p) => p - 1);
    else reload();
  }

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const cols = canManage ? 7 : 6;

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search categories…" aria-label="Search categories" className={cn(inputCls, "pl-8 pr-8")} />
          {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
        </div>
        {canManage && (
          <Button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> Add Category
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "category" : "categories"}</CardTitle></CardHeader>

        {loading ? (
          <div className="p-4"><TableSkeleton rows={PAGE_SIZE} cols={cols} /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-gray-900">Could not load categories</p>
            <p className="mt-1 text-xs text-gray-500">{error}</p>
            <button type="button" onClick={reload} className="mt-3 inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={committedSearch ? "No categories match your search" : "No categories yet"}
            description={committedSearch ? "Try a different search." : canManage ? "Add your first category to get started." : undefined}
            action={!committedSearch && canManage ? (<Button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus aria-hidden="true" /> Add Category</Button>) : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Category</TH><TH>Gender</TH><TH className="text-right">Services</TH><TH className="text-right">Subcategories</TH>
                <TH>Status</TH><TH>Created</TH>{canManage && <TH className="text-right">Actions</TH>}
              </tr>
            </THead>
            <tbody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="font-mono text-[11px] text-gray-400">{c.slug}</p>
                  </TD>
                  <TD className="text-xs capitalize text-gray-500">{c.gender.toLowerCase()}</TD>
                  <TD className="text-right text-gray-600">{c._count.services}</TD>
                  <TD className="text-right text-gray-600">{c._count.subCategories}</TD>
                  <TD><Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Inactive"}</Badge></TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(c.createdAt)}</TD>
                  {canManage && (
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => { setEditing(c); setFormOpen(true); }} aria-label={`Edit ${c.name}`} className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => setPendingDelete(c)} aria-label={`Delete ${c.name}`} className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !error && rows.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            <span>{from}–{to} of {total}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Card>

      {canManage && (
        <>
          <CategoryFormDialog open={formOpen} category={editing} onClose={() => setFormOpen(false)} onSaved={(m) => { setFormOpen(false); afterMutation(m); }} />
          <DeleteCategoryDialog category={pendingDelete} onClose={() => setPendingDelete(null)} onDeleted={() => { const removed = pendingDelete; setPendingDelete(null); afterMutation("Category deleted", true); void removed; }} />
        </>
      )}
    </div>
  );
}

// ── Add / edit dialog ───────────────────────────────────────────────────────
function CategoryFormDialog({
  open, category, onClose, onSaved,
}: {
  open: boolean;
  category: CategoryRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [form, setForm] = React.useState<FormState>({ name: "", description: "", gender: "UNISEX", sortOrder: "0", isActive: true });
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset to the subject whenever the dialog opens for a new add/edit target.
  const key = open ? category?.id ?? "new" : null;
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  if (key !== null && key !== shownKey) {
    setShownKey(key);
    setForm(category
      ? { name: category.name, description: category.description ?? "", gender: category.gender, sortOrder: String(category.sortOrder), isActive: category.isActive }
      : { name: "", description: "", gender: "UNISEX", sortOrder: "0", isActive: true });
    setNameErr(null);
    setFormError(null);
    setSaving(false);
  } else if (key === null && shownKey !== null) {
    setShownKey(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setNameErr("Category name is required"); return; }
    setNameErr(null);
    setFormError(null);
    setSaving(true);
    const payload = { name: form.name.trim(), description: form.description.trim() || null, gender: form.gender, sortOrder: Number(form.sortOrder) || 0, isActive: form.isActive };
    try {
      const res = await fetch(category ? API.admin.category(category.id) : API.admin.categories, {
        method: category ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        if ((json.message || "").toLowerCase().includes("name")) setNameErr(json.message);
        else setFormError(json.message || "Could not save the category");
        return;
      }
      onSaved(category ? "Category updated" : "Category created");
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !saving) onClose(); }}
      aria-labelledby="cat-form-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={submit} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="cat-form-title" className="text-sm font-semibold text-gray-900">{category ? "Edit category" : "Add category"}</h2>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"><X className="size-4" /></button>
          </div>
          <div className="space-y-4 px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Category name<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></label>
              <input value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameErr(null); }} disabled={saving} aria-invalid={Boolean(nameErr)} className={cn(inputCls, nameErr && invalidCls)} />
              {nameErr && <p role="alert" className="text-[11px] text-red-600">{nameErr}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Gender</label>
                <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))} disabled={saving} className={inputCls}>
                  {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Sort order</label>
                <input type="number" step="1" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} disabled={saving} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Description</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={saving} className={cn(inputCls, "h-auto py-2")} />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} disabled={saving} className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
              Active
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">{saving ? "Saving…" : category ? "Save changes" : "Create category"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

// ── Delete confirm ──────────────────────────────────────────────────────────
function DeleteCategoryDialog({
  category, onClose, onDeleted,
}: {
  category: CategoryRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = category !== null;
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && category.id !== shownId) { setShownId(category.id); setDeleting(false); setError(null); }
  else if (!open && shownId !== null) setShownId(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function confirm() {
    if (!category || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(API.admin.category(category.id), { method: "DELETE" });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        // e.g. "Cannot delete category because services exist" — show it, stay open.
        setError(json.message || "Could not delete this category");
        return;
      }
      onDeleted();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!deleting) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !deleting) onClose(); }}
      className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {category && (
        <div className="p-5">
          <h2 className="text-sm font-semibold text-gray-900">Delete category</h2>
          <p className="mt-1 text-xs text-gray-500">Delete <span className="font-medium text-gray-700">{category.name}</span>? This cannot be undone.</p>
          {error && <p role="alert" className="mt-2 rounded border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">{error}</p>}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={deleting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={confirm} disabled={deleting} className="inline-flex h-9 items-center rounded bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
