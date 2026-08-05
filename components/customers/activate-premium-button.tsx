"use client";

// Super Admin — activate a membership plan for a customer (complimentary by
// default). Posts to the existing sell endpoint so benefits and invoices stay
// consistent with desk / online purchases.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

export type PremiumPlanOption = {
  id: string;
  name: string;
  tier: string;
  price: number;
  validityDays: number;
  walletCredit: number;
};

export type PremiumBranchOption = {
  id: string;
  name: string;
};

type Props = {
  customerId: string;
  defaultBranchId?: string | null;
  hasActiveMembership: boolean;
  activePlanName?: string | null;
  plans: PremiumPlanOption[];
  branches: PremiumBranchOption[];
};

export function ActivatePremiumButton({
  customerId,
  defaultBranchId,
  hasActiveMembership,
  activePlanName,
  plans,
  branches,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const [branchId, setBranchId] = React.useState(
    defaultBranchId && branches.some((b) => b.id === defaultBranchId)
      ? defaultBranchId
      : (branches[0]?.id ?? "")
  );
  const [price, setPrice] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;

  async function activate() {
    if (!planId) {
      setError("Choose a plan");
      return;
    }
    if (!branchId) {
      setError("Choose a branch");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const priceValue = Number(price);
      const res = await fetch(API.admin.membershipSell, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          planId,
          branchId,
          priceOverride: Number.isFinite(priceValue) ? priceValue : 0,
          notes: notes.trim() || "Activated by super admin",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const fieldErrors =
          json?.errors && typeof json.errors === "object"
            ? Object.values(json.errors as Record<string, string[]>)
                .flat()
                .join(" · ")
            : "";
        throw new Error(fieldErrors || json?.message || "Could not activate premium");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate premium");
      setBusy(false);
    }
  }

  if (hasActiveMembership) {
    return (
      <p className="text-xs text-emerald-700">
        Premium active{activePlanName ? `: ${activePlanName}` : ""}. Cancel or
        wait for expiry before activating another plan.
      </p>
    );
  }

  if (plans.length === 0) {
    return (
      <p className="text-xs text-amber-700">
        No active membership plans. Create one under Memberships first.
      </p>
    );
  }

  if (branches.length === 0) {
    return (
      <p className="text-xs text-amber-700">
        No active branches. Add a branch before activating premium.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setBusy(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800"
      >
        <Crown className="size-3.5" aria-hidden="true" />
        Activate Premium
      </button>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Activate premium
      </p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-600">Plan</span>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.tier} · ₹{p.price.toLocaleString("en-IN")} ·{" "}
              {p.validityDays}d
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-600">Branch</span>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-600">
          Charge ₹ (0 = complimentary)
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        />
      </label>

      {plan && (
        <p className="text-[11px] text-gray-500">
          Valid {plan.validityDays} days from today
          {plan.walletCredit > 0
            ? ` · ₹${plan.walletCredit.toLocaleString("en-IN")} wallet credit`
            : ""}
          . Activates immediately.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-600">Notes</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Activated by super admin"
          className="h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={activate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
          Confirm activate
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
