"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { Scissors, Check, Loader2, Save } from "lucide-react";

// Super-admin / branch-admin panel to assign which services a worker can perform.
// The assignable set is scoped to services actually offered at the worker's
// branch (those with an active ServiceBranchPricing), matching the requirement
// that a worker is only assigned services available at their salon branch.

type BranchService = {
  id: string;
  name: string;
  duration: number;
  basePrice: number;
  branchPricings?: { price: number }[];
  category?: { name: string };
};
type AssignedService = { id: string; name: string; duration: number; basePrice: number };

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function priceOf(s: BranchService) {
  return s.branchPricings?.[0]?.price ?? s.basePrice;
}

export function WorkerServicesManager({
  workerId,
  branch,
  assigned,
}: {
  workerId: string;
  branch: { id: string; name: string } | null;
  assigned: AssignedService[];
}) {
  const router = useRouter();
  const [branchServices, setBranchServices] = React.useState<BranchService[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; ok: boolean } | null>(null);

  const initialIds = React.useMemo(() => new Set(assigned.map((a) => a.id)), [assigned]);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(assigned.map((a) => a.id)));

  React.useEffect(() => {
    if (!branch) { setLoading(false); return; }
    let cancelled = false;
    fetch(`${API.public.services}?branchId=${branch.id}&limit=200`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setBranchServices(j.data?.items ?? j.data ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branch]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const branchServiceIds = React.useMemo(() => new Set(branchServices.map((s) => s.id)), [branchServices]);
  // Services the worker already has that this branch does NOT offer — surfaced
  // separately so saving never silently drops a valid assignment from elsewhere.
  const assignedOutside = assigned.filter((a) => !branchServiceIds.has(a.id) && !loading);

  const dirty =
    selected.size !== initialIds.size ||
    [...selected].some((id) => !initialIds.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Group branch services by category for a tidy list.
  const grouped = React.useMemo(() => {
    const map = new Map<string, BranchService[]>();
    for (const s of branchServices) {
      const cat = s.category?.name ?? "Services";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries());
  }, [branchServices]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(API.admin.workerServices(workerId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: [...selected] }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.message ?? "Failed to save");
      setToast({ text: "Services updated", ok: true });
      router.refresh();
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Failed to save", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (!branch) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Assign this worker to a branch before choosing services.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Assign services</p>
          <p className="text-xs text-gray-500">
            {selected.size} selected · services offered at <span className="font-medium">{branch.name}</span>
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
      ) : branchServices.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          No services are configured for {branch.name} yet — add branch pricing for services first.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, items]) => (
            <div key={cat}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{cat}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                        on ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`flex size-5 items-center justify-center rounded-md border ${on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-transparent"}`}>
                          <Check className="size-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-400">{s.duration} min</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{money(priceOf(s))}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {assignedOutside.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                Also assigned · not offered at this branch
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {assignedOutside.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                        on ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`flex size-5 items-center justify-center rounded-md border ${on ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300 text-transparent"}`}>
                          <Check className="size-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-400">{s.duration} min · kept from elsewhere</p>
                        </div>
                      </div>
                      <Scissors className="size-4 text-gray-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 rounded-xl border bg-white px-4 py-3 shadow-lg ${
            toast.ok ? "border-emerald-200" : "border-red-200"
          }`}
        >
          <Check className={`size-4 ${toast.ok ? "text-emerald-600" : "text-red-600"}`} />
          <p className="text-sm font-medium text-gray-800">{toast.text}</p>
        </div>
      )}
    </div>
  );
}
