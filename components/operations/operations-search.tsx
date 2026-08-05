"use client";

// ============================================================================
// MODULE : Manual Operations — global search box
//
// One field across customers, appointments, invoices, workers and products. Sits
// at the top of the hub because the front desk's first action is almost always
// "find this person" — by name, by phone, by invoice number.
//
// Debounced, aborts superseded requests, and closes on outside click or Escape.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, CalendarDays, Receipt, Scissors, Package } from "lucide-react";
import { API } from "@/lib/endpoints";
import { useDismiss } from "@/components/dashboard/use-dismiss";

type SearchHit = {
  kind: "customer" | "appointment" | "invoice" | "worker" | "product";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const KIND_ICON = {
  customer: User,
  appointment: CalendarDays,
  invoice: Receipt,
  worker: Scissors,
  product: Package,
} as const;

const KIND_LABEL = {
  customer: "Customer",
  appointment: "Appointment",
  invoice: "Invoice",
  worker: "Staff",
  product: "Product",
} as const;

export function OperationsSearch({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [term, setTerm] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const boxRef = useDismiss<HTMLDivElement>(() => setOpen(false));

  // A query too short to search shows nothing. DERIVED rather than cleared in the
  // effect: synchronously calling setState in an effect body triggers a second
  // render pass with the stale list still painted, which is what
  // react-hooks/set-state-in-effect exists to catch.
  const visible = term.trim().length >= 2 ? hits : [];

  React.useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;

    // AbortController, not a "latest request wins" flag: a slow early response
    // must not be able to overwrite a fast later one.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `${API.admin.operationsSearch}?q=${encodeURIComponent(q)}&base=${encodeURIComponent(basePath)}`,
          { signal: controller.signal }
        );
        const json = await res.json().catch(() => null);
        if (json?.success) {
          setHits(json.data.items ?? []);
          setOpen(true);
        }
      } catch {
        // An aborted request is the normal case while typing, not an error.
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, basePath]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)"
          aria-hidden="true"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => visible.length > 0 && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search customers, appointments, invoices, staff, products…"
          aria-label="Search everything"
          className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30"
        />
        {busy && (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400"
            aria-hidden="true"
          />
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-(--sa-border) dark:bg-(--sa-surface)">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400 dark:text-(--sa-muted)">
              {busy ? "Searching…" : "Nothing matched."}
            </p>
          ) : (
            <ul>
              {visible.map((hit) => {
                const Icon = KIND_ICON[hit.kind];
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(hit.href);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <Icon
                        className="size-3.5 shrink-0 text-gray-400 dark:text-(--sa-muted)"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-800 dark:text-(--sa-text)">
                          {hit.title}
                        </span>
                        <span className="block truncate text-[11px] text-gray-400 dark:text-(--sa-muted)">
                          {hit.subtitle}
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-(--sa-text-2)">
                        {KIND_LABEL[hit.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export { type SearchHit };
