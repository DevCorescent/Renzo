"use client";

// ============================================================================
// MODULE : Invoices — thermal receipt print size
//
// How large the till receipt's text prints, as a percentage (100 = normal).
// Offered as quick buttons (100% / 150%) plus a custom value, and remembered PER
// COMPUTER in localStorage: each front desk has its own printer and roll, so the
// size that reads well belongs to the till, not to the branch.
//
// The value travels to /billing/:id/print-thermal as ?scale=, which enlarges the
// text while the page still sizes itself to the roll — so the paper-size fix keeps
// working and Chrome's own Scale setting stays untouched at Default.
//
// Every control on the page shares one store (useSyncExternalStore + a window
// event), so changing the size in one place updates every Print button at once.
// ============================================================================

import * as React from "react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

export const RECEIPT_SCALE_MIN = 50;
export const RECEIPT_SCALE_MAX = 200;
const RECEIPT_SCALE_PRESETS = [100, 150];
const DEFAULT_SCALE = 100;

const STORAGE_KEY = "renzo.receiptScale";
const CHANGE_EVENT = "renzo:receipt-scale";

/** Whole percent inside the supported range; anything unreadable is 100. */
export function clampReceiptScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE;
  return Math.min(RECEIPT_SCALE_MAX, Math.max(RECEIPT_SCALE_MIN, Math.round(value)));
}

// In-memory fallback for browsers where storage is blocked (private windows), so
// the control still works for the session instead of snapping back to 100.
let memoryScale = DEFAULT_SCALE;

function readScale(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? clampReceiptScale(Number(raw)) : memoryScale;
  } catch {
    return memoryScale;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useReceiptScale(): [number, (next: number) => void] {
  const scale = React.useSyncExternalStore(subscribe, readScale, () => DEFAULT_SCALE);

  const setScale = React.useCallback((next: number) => {
    memoryScale = clampReceiptScale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(memoryScale));
    } catch {
      /* storage blocked — the in-memory value still applies */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [scale, setScale];
}

/** The auto-printing receipt page for an invoice at a roll width and text size. */
export function thermalReceiptUrl(invoiceId: string, mm: 58 | 80, scale: number): string {
  const params = new URLSearchParams({ mm: String(mm) });
  const clamped = clampReceiptScale(scale);
  if (clamped !== DEFAULT_SCALE) params.set("scale", String(clamped));
  return `${API.reception.bill(invoiceId)}/print-thermal?${params.toString()}`;
}

const segment = "px-2.5 py-1.5 text-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20";
const segmentOn = "bg-gray-900 font-medium text-white dark:bg-white dark:text-gray-900";
const segmentOff =
  "bg-white text-gray-600 hover:bg-gray-50 dark:bg-(--sa-surface) dark:text-(--sa-text-2) dark:hover:bg-white/5";

/** 100% · 150% · custom — the receipt text size, shared by every Print button. */
export function ReceiptScaleControl({ className }: { className?: string }) {
  const [scale, setScale] = useReceiptScale();
  // Draft while typing; null means "show the saved value".
  const [draft, setDraft] = React.useState<string | null>(null);

  const isPreset = RECEIPT_SCALE_PRESETS.includes(scale);
  const customActive = !isPreset && draft === null;

  function commitDraft() {
    if (draft === null) return;
    const value = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(value)) setScale(value);
    setDraft(null);
  }

  return (
    <div
      role="group"
      aria-label="Receipt print size"
      title={`Receipt text size (${RECEIPT_SCALE_MIN}–${RECEIPT_SCALE_MAX}%) — remembered on this computer`}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded border border-gray-200 dark:border-(--sa-border)",
        className
      )}
    >
      <span className="flex items-center bg-gray-50 px-2 text-[11px] text-gray-500 dark:bg-white/5 dark:text-(--sa-muted)">
        Size
      </span>
      {RECEIPT_SCALE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={scale === preset}
          onClick={() => {
            setDraft(null);
            setScale(preset);
          }}
          className={cn(segment, "border-l border-gray-200 dark:border-(--sa-border)", scale === preset ? segmentOn : segmentOff)}
        >
          {preset}%
        </button>
      ))}
      <label
        className={cn(
          "flex items-center gap-0.5 border-l border-gray-200 pl-2 pr-2 dark:border-(--sa-border)",
          customActive ? segmentOn : "bg-white dark:bg-(--sa-surface)"
        )}
      >
        <span className="sr-only">Custom receipt size in percent</span>
        <input
          type="number"
          inputMode="numeric"
          min={RECEIPT_SCALE_MIN}
          max={RECEIPT_SCALE_MAX}
          step={5}
          placeholder="Custom"
          value={draft ?? (isPreset ? "" : String(scale))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          className={cn(
            "w-14 bg-transparent py-1.5 text-xs outline-none [appearance:textfield] placeholder:text-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            customActive ? "text-white dark:text-gray-900" : "text-gray-700 dark:text-(--sa-text)"
          )}
        />
        <span className={cn("text-xs", customActive ? "text-white/70 dark:text-gray-900/60" : "text-gray-400")}>%</span>
      </label>
    </div>
  );
}
