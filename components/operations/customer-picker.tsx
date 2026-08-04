"use client";

// ============================================================================
// MODULE : Manual Operations — customer picker
//
// A type-ahead over the EXISTING /admin/customers/search endpoint, shared by the
// sale terminal, the membership sale and the loyalty adjustment. Those three all
// begin with "which customer?", and three copies of this is three chances for one
// of them to stop respecting branch scope.
// ============================================================================

import * as React from "react";
import { Search, Loader2, X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { useDismiss } from "@/components/dashboard/use-dismiss";

export type PickedCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  totalVisits: number;
};

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";

export function CustomerPicker({
  value,
  onChange,
  label = "Customer",
}: {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  label?: string;
}) {
  const [term, setTerm] = React.useState("");
  const [hits, setHits] = React.useState<PickedCustomer[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const boxRef = useDismiss<HTMLDivElement>(() => setOpen(false));

  // Derived, not cleared in the effect — see the note in operations-search.tsx.
  const visible = term.trim().length >= 2 ? hits : [];

  React.useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`${API.admin.customerSearch}?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (json?.success) {
          setHits(json.data.items ?? []);
          setOpen(true);
        }
      } catch {
        // Aborted while typing — expected, not an error.
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  if (value) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
          {label}
        </label>
        <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-2 dark:border-(--sa-border) dark:bg-white/5">
          <span className="min-w-0">
            <span className="block truncate text-sm text-gray-800 dark:text-(--sa-text)">
              {`${value.firstName} ${value.lastName ?? ""}`.trim()}
            </span>
            <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
              {value.phone ?? "No phone"} · {value.totalVisits} visit
              {value.totalVisits === 1 ? "" : "s"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTerm("");
            }}
            aria-label="Choose a different customer"
            className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label
        className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)"
        htmlFor="op-customer"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)"
          aria-hidden="true"
        />
        <input
          id="op-customer"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => visible.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search by name or phone…"
          className={`${inputCls} pl-8`}
          autoComplete="off"
        />
        {busy && (
          <Loader2
            className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-gray-400"
            aria-hidden="true"
          />
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-(--sa-border) dark:bg-(--sa-surface)">
          {visible.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-gray-400 dark:text-(--sa-muted)">
              {busy ? "Searching…" : "No customer found — add them first."}
            </li>
          ) : (
            visible.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(hit);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span className="block truncate text-sm text-gray-800 dark:text-(--sa-text)">
                    {`${hit.firstName} ${hit.lastName ?? ""}`.trim()}
                  </span>
                  <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                    {hit.phone ?? "No phone"} · {hit.totalVisits} visit
                    {hit.totalVisits === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
