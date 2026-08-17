"use client";

// ============================================================================
// MODULE : Branch Operating Hours (editor)
// FLOW   : Seed 7 rows from saved timings (missing days fall back to a sensible
//          default) → edit open/close/slot per day → dirty tracking → PUT
//          /admin/branches/[id]/timings → toast + rebaseline.
// ACCESS : Rendered by the Super Admin branch detail page and the Branch Admin
//          "Operating Hours" page. The API re-checks role AND branch scope, so a
//          BRANCH_ADMIN can only ever write their own branch's hours.
// WHY    : Branch hours drive the bookable slot grid (lib/slots.ts). Until now
//          they could only be seeded, so a new branch showed "Closed" on /book
//          with no way to fix it from the dashboard.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, Copy, Info } from "lucide-react";
import { API } from "@/lib/endpoints";

export type BranchTiming = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  slotDuration: number;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "21:00";
const DEFAULT_SLOT = 30;

// "9:00" / "09:00:00" both normalise to "09:00" — <input type="time"> only
// accepts the padded HH:MM form, and that is what the slot engine parses.
function normalizeTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Always render all 7 days: a day with no saved row is simply "closed" to the
// slot engine, and the admin needs a control to turn it on.
function seedRows(saved: BranchTiming[]): BranchTiming[] {
  const byDay = new Map(saved.map((t) => [t.dayOfWeek, t]));
  return Array.from({ length: 7 }, (_, day) => {
    const t = byDay.get(day);
    return {
      dayOfWeek: day,
      openTime: normalizeTime(t?.openTime, DEFAULT_OPEN),
      closeTime: normalizeTime(t?.closeTime, DEFAULT_CLOSE),
      // Unsaved days start ticked open so a brand-new branch is one Save away
      // from being bookable; saved days keep whatever was stored.
      isOpen: t ? t.isOpen : true,
      slotDuration: t?.slotDuration ?? DEFAULT_SLOT,
    };
  });
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// "12h" / "8h 30m" — the open window, shown next to each day.
function formatSpan(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const timeInputCls =
  "w-[6.5rem] bg-transparent text-sm text-gray-900 outline-none disabled:text-gray-400 dark:text-(--sa-text) dark:disabled:text-(--sa-muted)";

const fieldCls =
  "flex h-9 items-center rounded-md border border-gray-200 bg-white px-2 transition focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-900/5 dark:border-(--sa-border) dark:bg-(--sa-tile)";

export function BranchTimingsEditor({
  branchId,
  initial,
  canEdit = true,
}: {
  branchId: string;
  initial: BranchTiming[];
  /** Read-only render for roles without write access (the API is the real gate). */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<BranchTiming[]>(() => seedRows(initial));
  const [baseline, setBaseline] = React.useState<BranchTiming[]>(() => seedRows(initial));
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ text: string; ok: boolean } | null>(null);

  const neverSaved = initial.length === 0;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = React.useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(baseline),
    [rows, baseline]
  );

  // A closed day's times are never read, so only validate the open ones.
  const rowErrors = React.useMemo(() => {
    const errs = new Map<number, string>();
    for (const r of rows) {
      if (!r.isOpen) continue;
      if (toMinutes(r.closeTime) <= toMinutes(r.openTime)) {
        errs.set(r.dayOfWeek, "Closing time must be after opening time");
      } else if (toMinutes(r.closeTime) - toMinutes(r.openTime) < r.slotDuration) {
        errs.set(r.dayOfWeek, `Open window is shorter than one ${r.slotDuration}-min slot`);
      }
    }
    return errs;
  }, [rows]);

  const openCount = rows.filter((r) => r.isOpen).length;

  function update(day: number, patch: Partial<BranchTiming>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)));
  }

  // Copy one day's hours across the week. Each day's own open/closed state is
  // preserved — copying Monday's hours must not accidentally re-open Sunday.
  function copyToAll(day: number) {
    const src = rows.find((r) => r.dayOfWeek === day);
    if (!src) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        openTime: src.openTime,
        closeTime: src.closeTime,
        slotDuration: src.slotDuration,
      }))
    );
    setToast({ text: `${DAYS[day]}'s hours applied to every day`, ok: true });
  }

  async function handleSave() {
    if (rowErrors.size > 0) {
      setToast({ text: "Fix the highlighted days first", ok: false });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API.admin.branchTimings(branchId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timings: rows }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? "Failed to save operating hours");
      }
      setBaseline(rows);
      setToast({ text: "Operating hours saved", ok: true });
      router.refresh();
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Failed to save operating hours", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      {neverSaved && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          No hours saved yet — this branch shows as <strong>Closed</strong> to customers and has no
          bookable slots. Suggested hours are pre-filled below; review and save.
        </p>
      )}

      {/* ── Rows ─────────────────────────────────────────────────────────────
          One line per day: [toggle · day] [open – close] [slot length] [span]
          [copy]. Everything is vertically centred on a 40px row so the week
          scans as a table rather than seven stacked forms. */}
      <div className="overflow-x-auto">
        <div className="min-w-136 divide-y divide-gray-100 dark:divide-(--sa-border)">
          {rows.map((r) => {
            const error = rowErrors.get(r.dayOfWeek);
            const span = r.isOpen ? toMinutes(r.closeTime) - toMinutes(r.openTime) : 0;
            const slots = span > 0 ? Math.floor(span / r.slotDuration) : 0;

            return (
              <div key={r.dayOfWeek} className="py-1.5">
                <div className="flex items-center gap-2">
                  {/* Day + open switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.isOpen}
                    aria-label={`${DAYS[r.dayOfWeek]} open`}
                    disabled={!canEdit || saving}
                    onClick={() => update(r.dayOfWeek, { isOpen: !r.isOpen })}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      r.isOpen
                        ? "bg-emerald-500"
                        : "bg-gray-200 dark:bg-(--sa-hover)"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                        r.isOpen ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`w-24 shrink-0 text-sm font-medium ${
                      r.isOpen
                        ? "text-gray-800 dark:text-(--sa-text)"
                        : "text-gray-400 dark:text-(--sa-muted)"
                    }`}
                  >
                    {DAYS[r.dayOfWeek]}
                  </span>

                  {r.isOpen ? (
                    <>
                      <div className={fieldCls}>
                        <input
                          type="time"
                          value={r.openTime}
                          disabled={!canEdit || saving}
                          onChange={(e) => update(r.dayOfWeek, { openTime: e.target.value })}
                          aria-label={`${DAYS[r.dayOfWeek]} opening time`}
                          className={timeInputCls}
                        />
                        <span className="px-1 text-gray-300 dark:text-(--sa-muted)">–</span>
                        <input
                          type="time"
                          value={r.closeTime}
                          disabled={!canEdit || saving}
                          onChange={(e) => update(r.dayOfWeek, { closeTime: e.target.value })}
                          aria-label={`${DAYS[r.dayOfWeek]} closing time`}
                          className={timeInputCls}
                        />
                      </div>

                      <select
                        value={r.slotDuration}
                        disabled={!canEdit || saving}
                        onChange={(e) => update(r.dayOfWeek, { slotDuration: Number(e.target.value) })}
                        aria-label={`${DAYS[r.dayOfWeek]} slot length`}
                        className="h-9 shrink-0 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:text-gray-400 dark:border-(--sa-border) dark:bg-(--sa-tile) dark:text-(--sa-text)"
                      >
                        {SLOT_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m} min</option>
                        ))}
                      </select>

                      {/* Live consequence of the three inputs to its left. */}
                      <span className="hidden shrink-0 text-xs text-gray-400 tabular-nums dark:text-(--sa-muted) sm:inline">
                        {span > 0 ? `${formatSpan(span)} · ${slots} slots` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-(--sa-tile) dark:text-(--sa-muted)">
                      Closed all day
                    </span>
                  )}

                  {canEdit && r.isOpen && (
                    <button
                      type="button"
                      onClick={() => copyToAll(r.dayOfWeek)}
                      disabled={saving}
                      title={`Apply ${DAYS[r.dayOfWeek]}'s hours to every day`}
                      aria-label={`Apply ${DAYS[r.dayOfWeek]}'s hours to every day`}
                      className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-(--sa-muted) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  )}
                </div>
                {error && <p className="pl-13 text-xs text-red-600">{error}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── What a "slot" is ─────────────────────────────────────────────────
          Collapsed by default so it explains the jargon without competing with
          the controls. */}
      <details className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-(--sa-border) dark:bg-(--sa-tile)">
        <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-gray-600 dark:text-(--sa-text-2)">
          <Info className="size-3.5" /> What is a slot?
        </summary>
        <p className="mt-2 leading-relaxed text-gray-500 dark:text-(--sa-muted)">
          A <strong>slot</strong> is one bookable start time. The slot length is the gap between two
          consecutive start times, so a 09:00–21:00 day with 30-min slots offers 09:00, 09:30,
          10:00 … 20:30 — 24 slots per stylist. Shorter slots mean a finer grid and more choice for
          customers; longer slots mean fewer, tidier appointment starts. It is not the length of the
          service itself — a 60-minute service booked at 09:00 simply occupies the stylist until
          10:00 and hides the start times it overlaps.
        </p>
      </details>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty || rowErrors.size > 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {saving ? "Saving…" : "Save hours"}
          </button>
          {dirty && !saving && (
            <button
              type="button"
              onClick={() => setRows(baseline)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
            >
              Reset
            </button>
          )}
          <p className="text-[11px] text-gray-400 dark:text-(--sa-muted)">
            Open {openCount} of 7 days
            {dirty ? " · unsaved changes" : ""}
          </p>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-100 flex w-80 max-w-[calc(100vw-3rem)] items-center gap-2.5 rounded-xl border bg-white p-4 shadow-lg dark:bg-(--sa-elevated) ${
            toast.ok ? "border-emerald-200 dark:border-emerald-900" : "border-red-200 dark:border-red-900"
          }`}
        >
          {toast.ok ? (
            <Check className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <X className="size-4 shrink-0 text-red-600" />
          )}
          <p className="text-sm font-medium text-gray-800 dark:text-(--sa-text)">{toast.text}</p>
        </div>
      )}
    </div>
  );
}
