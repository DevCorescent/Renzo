"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import {
  addDays,
  daysBetween,
  isoMonthLabel,
  parseISODate,
  startOfMonth,
  toISODate,
  today,
} from "./date-utils";

/* ── booking date picker ──────────────────────────────────────────────────────
   Two ways to pick the same value:

   1. A horizontal strip of day chips. It lives in its own scroll container that
      is allowed to be narrower than its content — the parent must therefore give
      it `min-w-0`, otherwise the strip's intrinsic width leaks upward, widens the
      column past the viewport, and the layout clips instead of scrolling (the bug
      this component replaces).
   2. A month grid for anything further out than the strip shows. It renders as a
      bottom sheet under `sm` and as an anchored popover from `sm` up, so the same
      component works on a 320px phone and on a desktop sidebar layout.
── ─────────────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
/** Chips rendered in the strip at once. */
const STRIP_DAYS = 14;
/** Keeps the selected chip off the very edge when the strip re-anchors. */
const STRIP_LEAD_IN = 3;
/** Popover width at sm+ (matches `w-80`). */
const POPOVER_WIDTH_PX = 320;
/** Clearance kept from the viewport edges, and below the fixed site header. */
const VIEWPORT_MARGIN_PX = 8;
const HEADER_INSET_PX = 96;
/** Never squash the grid smaller than this; it scrolls internally instead. */
const MIN_POPOVER_HEIGHT_PX = 260;

export function BookingDatePicker({
  value,
  onChange,
  maxAdvanceDays = 90,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** How far ahead bookings are accepted, in days from today. */
  maxAdvanceDays?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const todayIso = React.useMemo(() => today(), []);
  const maxIso = React.useMemo(
    () => addDays(todayIso, maxAdvanceDays),
    [todayIso, maxAdvanceDays],
  );

  // The strip normally starts at today. Once the customer picks a date from the
  // calendar that sits past the strip, it re-anchors around that date so the
  // selection is always visible instead of silently off-screen.
  const stripStart = React.useMemo(() => {
    const offset = daysBetween(todayIso, value);
    if (offset < STRIP_DAYS) return todayIso;
    return addDays(value, -STRIP_LEAD_IN);
  }, [todayIso, value]);

  const dates = React.useMemo(
    () =>
      Array.from({ length: STRIP_DAYS }, (_, i) => addDays(stripStart, i)).filter(
        (d) => daysBetween(todayIso, d) <= maxAdvanceDays,
      ),
    [stripStart, todayIso, maxAdvanceDays],
  );

  const stripRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });

  const syncEdges = React.useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      start: el.scrollLeft <= 1,
      // `max <= 1` means everything already fits — both arrows stay disabled.
      end: el.scrollLeft >= max - 1,
    });
  }, []);

  // Centre the selected chip. Done by writing scrollLeft rather than
  // scrollIntoView, which would also scroll the page under a mobile keyboard.
  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const chip = el.querySelector<HTMLElement>('[data-selected="true"]');
    if (chip) {
      el.scrollTo({
        left: chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2,
        behavior: "smooth",
      });
    }
    syncEdges();
  }, [value, dates, syncEdges]);

  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    syncEdges();
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges]);

  function nudge(dir: -1 | 1) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrowCls =
    "hidden size-9 shrink-0 self-center items-center justify-center rounded-full border border-white/10 bg-stone-900 text-stone-400 transition hover:border-stone-300/50 hover:text-stone-100 disabled:pointer-events-none disabled:opacity-30 sm:inline-flex";

  return (
    <div className={className}>
      {/* items-stretch lets the calendar button match the chip height at any
          font size, instead of pinning it to a magic pixel value. */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="Previous dates"
          onClick={() => nudge(-1)}
          disabled={edges.start}
          className={arrowCls}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* min-w-0 is load-bearing: without it this flex item refuses to shrink
            below the strip's intrinsic width and the whole page overflows. */}
        <div
          ref={stripRef}
          onScroll={syncEdges}
          className="no-scrollbar -my-1 flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-0.5 py-1"
        >
          {dates.map((d) => {
            const dt = parseISODate(d);
            const isToday = d === todayIso;
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => onChange(d)}
                className={`flex min-w-[3.75rem] shrink-0 snap-start flex-col items-center rounded-2xl border px-3 py-2.5 text-center transition duration-200 ease-out sm:min-w-[4rem] sm:px-3.5 ${
                  selected
                    ? "border-stone-200 bg-white/10 text-stone-100 shadow-[0_10px_30px_-24px_rgba(255,255,255,0.25)]"
                    : "border-white/10 bg-stone-900 text-stone-400 hover:-translate-y-0.5 hover:border-stone-300/50 hover:text-stone-100"
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide">
                  {isToday
                    ? "Today"
                    : dt.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="mt-0.5 text-lg font-bold leading-tight sm:text-xl">
                  {dt.getDate()}
                </span>
                <span className="text-[10px] text-stone-500">
                  {dt.toLocaleDateString("en-IN", { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Next dates"
          onClick={() => nudge(1)}
          disabled={edges.end}
          className={arrowCls}
        >
          <ChevronRight className="size-4" />
        </button>

        {/* The popover anchors to this button rather than to the full-width
            row, so it opens directly beneath "Pick date" instead of floating
            off at the far edge of the column. */}
        <div ref={anchorRef} className="shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`inline-flex h-full items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition ${
              open
                ? "border-stone-200 bg-white/10 text-stone-100"
                : "border-white/10 bg-stone-900 text-stone-300 hover:border-stone-300/50 hover:text-stone-100"
            }`}
          >
            <CalendarDays className="size-4 shrink-0" />
            <span className="hidden sm:inline">Pick date</span>
          </button>

          {open && (
            <MonthCalendar
              value={value}
              minIso={todayIso}
              maxIso={maxIso}
              anchorRef={anchorRef}
              onPick={(iso) => {
                onChange(iso);
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── month grid ─────────────────────────────────────────────────────────────── */

function MonthCalendar({
  value,
  minIso,
  maxIso,
  anchorRef,
  onPick,
  onClose,
}: {
  value: string;
  minIso: string;
  maxIso: string;
  /** The control the popover hangs off at sm+. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const [cursor, setCursor] = React.useState(() => startOfMonth(value));
  const panelRef = React.useRef<HTMLDivElement>(null);

  // `sheet` = full-width bottom sheet (mobile). `popover` = anchored card.
  // Tracked in state because the two modes need different DOM behaviour, not
  // just different classes.
  const [isSheet, setIsSheet] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 40rem)");
    const sync = () => setIsSheet(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /**
   * Popover position, in viewport coordinates.
   *
   * Measured and clamped rather than expressed as `top-full` / `bottom-full`:
   * with a purely CSS flip, an anchor sitting mid-page has too little room in
   * BOTH directions, so the panel ran off the top of the window with its month
   * header and nav arrows unreachable. Clamping into the viewport — and capping
   * the height so the grid scrolls instead of overflowing — always lands it
   * somewhere usable.
   */
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);

  const place = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = panel.offsetWidth || POPOVER_WIDTH_PX;
    const wanted = panel.scrollHeight;

    const roomBelow = vh - r.bottom - VIEWPORT_MARGIN_PX * 2;
    const roomAbove = r.top - HEADER_INSET_PX - VIEWPORT_MARGIN_PX;
    const up = roomBelow < Math.min(wanted, MIN_POPOVER_HEIGHT_PX) && roomAbove > roomBelow;

    const maxHeight = Math.max(
      MIN_POPOVER_HEIGHT_PX,
      Math.min(wanted, up ? roomAbove : roomBelow),
    );

    const rawTop = up
      ? r.top - VIEWPORT_MARGIN_PX - maxHeight
      : r.bottom + VIEWPORT_MARGIN_PX;
    const top = Math.min(
      Math.max(rawTop, HEADER_INSET_PX),
      Math.max(HEADER_INSET_PX, vh - maxHeight - VIEWPORT_MARGIN_PX),
    );

    const left = Math.min(
      Math.max(r.right - width, VIEWPORT_MARGIN_PX),
      vw - width - VIEWPORT_MARGIN_PX,
    );

    setPos({ top, left, maxHeight });
  }, [anchorRef]);

  // Re-place before paint, and whenever the month (and so the row count) or the
  // viewport changes. `true` on scroll catches scrolling ancestors too.
  React.useLayoutEffect(() => {
    if (isSheet !== false) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isSheet, place, cursor]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only the mobile sheet is modal, so only it locks the page behind it.
  React.useEffect(() => {
    if (!isSheet) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [isSheet]);

  const first = parseISODate(cursor);
  const leading = first.getDay();
  const daysInMonth = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(first.getFullYear(), first.getMonth(), i + 1)),
    ),
  ];

  const prevMonth = toISODate(
    new Date(first.getFullYear(), first.getMonth() - 1, 1),
  );
  const nextMonth = toISODate(
    new Date(first.getFullYear(), first.getMonth() + 1, 1),
  );
  const canPrev = prevMonth >= startOfMonth(minIso);
  const canNext = nextMonth <= startOfMonth(maxIso);

  const navCls =
    "inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-stone-300 transition hover:border-stone-300/50 hover:text-white disabled:pointer-events-none disabled:opacity-25";

  return (
    <>
      {/* Dim only in sheet mode. At sm+ this is a popover, so the backdrop is an
          invisible click-catcher — dimming the whole page there read as a modal. */}
      <div
        role="presentation"
        onClick={onClose}
        className={`fixed inset-0 z-40 ${isSheet === false ? "" : "bg-black/60 backdrop-blur-sm"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isSheet !== false}
        aria-label="Choose a date"
        style={
          isSheet === false && pos
            ? {
                top: pos.top,
                left: pos.left,
                width: POPOVER_WIDTH_PX,
                maxHeight: pos.maxHeight,
              }
            : undefined
        }
        className={
          isSheet === false
            ? `fixed z-50 overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-stone-900 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95)] ${
                // Hidden for the single frame before the first measurement,
                // so it never flashes at the wrong spot.
                pos ? "" : "invisible"
              }`
            : "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-stone-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-30px_80px_-40px_rgba(0,0,0,0.9)]"
        }
      >
        {/* Grab handle — reads as a sheet on touch, hidden on desktop. */}
        {isSheet !== false && (
          <div
            aria-hidden
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15"
          />
        )}

        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canPrev}
            onClick={() => setCursor(prevMonth)}
            className={navCls}
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-stone-100">
            {isoMonthLabel(cursor)}
          </p>
          <button
            type="button"
            aria-label="Next month"
            disabled={!canNext}
            onClick={() => setCursor(nextMonth)}
            className={navCls}
          >
            <ChevronRight className="size-4" />
          </button>
          {isSheet !== false && (
            <button type="button" aria-label="Close" onClick={onClose} className={navCls}>
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-stone-600"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <span key={`pad-${i}`} />;
            const disabled = iso < minIso || iso > maxIso;
            const selected = iso === value;
            const isToday = iso === minIso;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                aria-current={selected ? "date" : undefined}
                onClick={() => onPick(iso)}
                className={`flex aspect-square items-center justify-center rounded-full text-sm transition ${
                  selected
                    ? "bg-white font-bold text-stone-950"
                    : disabled
                      ? "cursor-not-allowed text-stone-700"
                      : isToday
                        ? "font-semibold text-stone-100 ring-1 ring-inset ring-stone-400/60 hover:bg-white/10"
                        : "text-stone-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {parseISODate(iso).getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => onPick(minIso)}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-stone-300 transition hover:bg-white/5 hover:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-stone-200"
          >
            <Check className="size-3.5" />
            Done
          </button>
        </div>
      </div>
    </>
  );
}
