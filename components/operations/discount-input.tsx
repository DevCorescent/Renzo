"use client";

// ============================================================================
// MODULE : Billing — the discount field
//
// One discount control for every place a bill is raised or edited: the walk-in
// console, the manual bill, the appointment "Bill" button and the invoice edit
// panel. The operator enters it as an AMOUNT (₹250) or a PERCENT (10%).
//
// Whatever the mode, the SERVER only ever receives a rupee amount — the same
// `discountAmount` it always took — so the invoice formula in
// lib/billing-service.ts (discount off the subtotal, GST on the remainder) is
// untouched. A percent is of the pre-tax subtotal, and the amount is capped at
// the subtotal, exactly as the server caps it.
// ============================================================================

import { cn } from "@/lib/utils";

export type DiscountMode = "AMOUNT" | "PERCENT";

const round2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** The rupee discount the entry means, capped at the subtotal. */
export function discountFrom(raw: string, mode: DiscountMode, subtotal: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || subtotal <= 0) return 0;
  const amount = mode === "PERCENT" ? (subtotal * Math.min(n, 100)) / 100 : n;
  return round2(Math.min(amount, subtotal));
}

export function DiscountInput({
  id,
  raw,
  mode,
  onRaw,
  onMode,
  subtotal,
  inputClassName,
  labelClassName,
  label = "Discount",
}: {
  id: string;
  raw: string;
  mode: DiscountMode;
  onRaw: (v: string) => void;
  onMode: (m: DiscountMode) => void;
  /** Pre-tax subtotal the discount comes off. */
  subtotal: number;
  inputClassName?: string;
  labelClassName?: string;
  label?: string;
}) {
  const amount = discountFrom(raw, mode, subtotal);
  const entered = Number(raw);
  const capped =
    Number.isFinite(entered) && entered > 0 &&
    (mode === "PERCENT" ? entered > 100 : entered > subtotal);

  return (
    <div>
      <label htmlFor={id} className={labelClassName ?? "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)"}>
        {label}
      </label>
      <div className="flex gap-1.5">
        <input
          id={id}
          type="number"
          min={0}
          max={mode === "PERCENT" ? 100 : undefined}
          step="0.01"
          inputMode="decimal"
          value={raw}
          onChange={(e) => onRaw(e.target.value)}
          placeholder="0"
          className={cn("min-w-0 flex-1", inputClassName)}
        />
        <div
          role="group"
          aria-label="Discount type"
          className="inline-flex shrink-0 overflow-hidden rounded border border-gray-200 text-xs dark:border-(--sa-border)"
        >
          {(["AMOUNT", "PERCENT"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "w-9 font-semibold transition",
                mode === m
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-transparent dark:text-(--sa-text-2) dark:hover:bg-white/5"
              )}
            >
              {m === "AMOUNT" ? "₹" : "%"}
            </button>
          ))}
        </div>
      </div>
      {(mode === "PERCENT" && amount > 0) || capped ? (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-(--sa-muted)">
          {mode === "PERCENT" && amount > 0 ? `${inr(amount)} off` : null}
          {capped ? `${mode === "PERCENT" && amount > 0 ? " · " : ""}capped at the subtotal ${inr(subtotal)}` : null}
        </p>
      ) : null}
    </div>
  );
}
