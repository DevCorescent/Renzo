// OWNER: Gauransh
// MODULE: Branch Admin — Branch Pricing (preserved original branch services workflow)
"use client";

import * as React from "react";
import Image from "next/image";
import { API } from "@/lib/endpoints";
import { Loader2, Plus, Pencil, Camera, X, Check, Info, Clock, Users } from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Category = { id: string; name: string };

type BranchService = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  basePrice: number;
  duration: number;
  gender: string;
  category: { id: string; name: string };
  branchPricing: { id: string; price: number; isActive: boolean } | null;
};

/* ─── Toggle ────────────────────────────────────────────────────────────────── */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title={on ? "Disable at this branch" : "Enable at this branch"}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        on ? "bg-emerald-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
          on ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ─── Service Card ──────────────────────────────────────────────────────────── */

function ServiceCard({
  svc,
  onSavePricing,
  onEdit,
}: {
  svc: BranchService;
  onSavePricing: (id: string, price: number, isActive: boolean) => Promise<void>;
  onEdit: (svc: BranchService) => void;
}) {
  const [price, setPrice] = React.useState(
    String(svc.branchPricing?.price ?? svc.basePrice)
  );
  const [isActive, setIsActive] = React.useState(svc.branchPricing?.isActive ?? false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const originalPrice = svc.branchPricing?.price ?? svc.basePrice;
  const originalActive = svc.branchPricing?.isActive ?? false;
  const hasChanges = parseFloat(price) !== originalPrice || isActive !== originalActive;

  async function save() {
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { setErr("Enter a valid price"); return; }
    setSaving(true); setErr(null);
    try {
      await onSavePricing(svc.id, p, isActive);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const genderLabel: Record<string, string> = { MALE: "Men", FEMALE: "Women", UNISEX: "Unisex" };

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all dark:bg-[var(--sa-surface)] ${
      isActive ? "border-emerald-200 shadow-emerald-50 dark:border-emerald-800" : "border-gray-200 opacity-80 dark:border-[var(--sa-border)]"
    }`}>
      {/* Image */}
      <div className="relative h-40 w-full bg-gray-100 dark:bg-[var(--sa-tile)]">
        {svc.image ? (
          <Image src={svc.image} alt={svc.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-4xl font-bold text-gray-200 dark:text-[var(--sa-muted)]">{svc.name[0]}</span>
          </div>
        )}
        {/* Active badge */}
        {isActive && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
            Active
          </span>
        )}
        {/* Edit image button */}
        <button
          onClick={() => onEdit(svc)}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-[var(--sa-tile)] dark:text-[var(--sa-muted)]">
            {svc.category.name}
          </span>
          <h3 className="font-semibold text-gray-900 leading-tight dark:text-[var(--sa-text)]">{svc.name}</h3>
          {svc.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-400 dark:text-[var(--sa-muted)]">{svc.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400 dark:text-[var(--sa-muted)]">
            <span className="flex items-center gap-1"><Clock className="size-3" />{svc.duration} min</span>
            <span className="flex items-center gap-1"><Users className="size-3" />{genderLabel[svc.gender] ?? svc.gender}</span>
          </div>
        </div>

        {/* Enable toggle + price */}
        <div className="border-t border-gray-100 pt-3 dark:border-[var(--sa-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Toggle on={isActive} onChange={setIsActive} />
              <span className="text-xs font-medium text-gray-600 dark:text-[var(--sa-text-2)]">
                {isActive ? "Offered here" : "Not offered"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">₹</span>
              <input
                type="number"
                min={0}
                step={10}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!isActive}
                className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm font-medium focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)] dark:disabled:bg-[var(--sa-surface)] dark:disabled:text-[var(--sa-muted)]"
              />
            </div>
          </div>
          {err && <p className="mt-1 text-[11px] text-red-500">{err}</p>}
          {hasChanges && (
            <button
              onClick={save}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : saved ? <Check className="size-3" /> : null}
              {saved ? "Saved!" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Create Modal ──────────────────────────────────────────────────────────── */

function CreateModal({
  categories,
  onClose,
  onCreate,
}: {
  categories: Category[];
  onClose: () => void;
  onCreate: (svc: BranchService) => void;
}) {
  const [form, setForm] = React.useState({
    name: "", categoryId: "", description: "", image: "",
    basePrice: "", duration: "", gender: "UNISEX",
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function set(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Name is required"); return; }
    if (!form.categoryId) { setErr("Category is required"); return; }
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price < 0) { setErr("Valid base price is required"); return; }
    const duration = parseInt(form.duration);
    if (isNaN(duration) || duration <= 0) { setErr("Valid duration is required"); return; }

    setSaving(true); setErr(null);
    try {
      const res = await fetch(API.admin.services, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description.trim() || undefined,
          image: form.image || undefined,
          basePrice: price,
          duration,
          gender: form.gender,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.message ?? "Failed to create"); return; }

      const category = categories.find((c) => c.id === form.categoryId)!;
      onCreate({
        ...json.data,
        category,
        branchPricing: { id: "", price, isActive: true },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-[var(--sa-border)]">
          <h2 className="font-semibold text-gray-900 dark:text-[var(--sa-text)]">Add New Service</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--sa-text)]"><X className="size-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: "70vh" }}>
          {/* Image upload */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">Service Image</label>
            <ImageUpload
              value={form.image}
              onChange={(url) => set("image", url ?? "")}
              label="Service Photo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Deep Hair Spa"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">
                Base Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" min={0} step={10}
                value={form.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
                placeholder="999"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">
                Duration (min) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" min={5} step={5}
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
                placeholder="60"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">For</label>
              <div className="flex gap-2">
                {[["UNISEX","All"], ["MALE","Men"], ["FEMALE","Women"]].map(([v, l]) => (
                  <button
                    key={v} type="button"
                    onClick={() => set("gender", v)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                      form.gender === v ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-[var(--sa-border)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What does this service include?"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
              />
            </div>
          </div>

          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create & Enable Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit Modal ────────────────────────────────────────────────────────────── */

function EditModal({
  svc,
  onClose,
  onSave,
}: {
  svc: BranchService;
  onClose: () => void;
  onSave: (id: string, image: string | null, description: string | null) => Promise<void>;
}) {
  const [image, setImage] = React.useState(svc.image ?? "");
  const [description, setDescription] = React.useState(svc.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      await onSave(svc.id, image || null, description.trim() || null);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-[var(--sa-border)]">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-[var(--sa-text)]">Edit Service</h2>
            <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">{svc.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--sa-text)]"><X className="size-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--sa-muted)]">
              <Camera className="inline size-3 mr-1" />Service Image
            </label>
            <ImageUpload
              value={image}
              onChange={(url) => setImage(url ?? "")}
              label="Service Photo"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this service includes…"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
            />
          </div>

          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export function BranchPricingPanel() {
  const [services, setServices] = React.useState<BranchService[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [filterActive, setFilterActive] = React.useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = React.useState(false);
  const [editSvc, setEditSvc] = React.useState<BranchService | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [svcRes, catRes] = await Promise.all([
          fetch(API.admin.branchServices),
          fetch(API.admin.categories),
        ]);
        const [svcJson, catJson] = await Promise.all([svcRes.json(), catRes.json()]);
        if (!svcRes.ok) throw new Error(svcJson?.message ?? "Failed to load");
        setServices(svcJson.data ?? []);
        // GET /admin/services/categories is PAGINATED, so the array is at data.items
        // (not data). Reading data straight set `categories` to the pagination
        // object, and the Add Service modal's `categories.map(...)` then threw.
        setCategories(catJson.data?.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load services");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSavePricing(serviceId: string, price: number, isActive: boolean) {
    const res = await fetch(API.admin.branchServices, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, price, isActive }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "Save failed");
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, branchPricing: { id: json.data.id, price, isActive } } : s
      )
    );
  }

  async function handleEditSave(id: string, image: string | null, description: string | null) {
    const res = await fetch(API.admin.service(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, description }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message ?? "Save failed");
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, image, description } : s));
  }

  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.name.toLowerCase().includes(q) || s.category.name.toLowerCase().includes(q);
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" && (s.branchPricing?.isActive ?? false)) ||
      (filterActive === "inactive" && !(s.branchPricing?.isActive ?? false));
    return matchSearch && matchActive;
  });

  const activeCount = services.filter((s) => s.branchPricing?.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header — the page/tab already names this section, so only the enabled-count
          summary and the (preserved) branch Add Service action remain here. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-[var(--sa-muted)]">
          {activeCount} of {services.length} services enabled at this branch
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <Plus className="size-4" /> Add Service
        </button>
      </div>

      {/* How-to tip */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs text-indigo-600">
          <span className="font-semibold">Enable/Disable</span> services using the toggle on each card.
          Set a <span className="font-semibold">branch-specific price</span> and hit <span className="font-semibold">Save Changes</span>.
          Click <span className="font-semibold">Edit</span> on any card to update the photo or description.
          Use <span className="font-semibold">Add Service</span> to create new services specific to your branch.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none sm:max-w-xs dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
        />
        <div className="flex gap-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filterActive === f
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-[var(--sa-border)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-7 animate-spin text-gray-300 dark:text-[var(--sa-muted)]" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-400 dark:text-[var(--sa-muted)]">No services found.</p>
          {services.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">
              + Add your first service
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <ServiceCard
              key={s.id}
              svc={s}
              onSavePricing={handleSavePricing}
              onEdit={setEditSvc}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreate={(svc) => setServices((prev) => [svc, ...prev])}
        />
      )}

      {editSvc && (
        <EditModal
          svc={editSvc}
          onClose={() => setEditSvc(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
