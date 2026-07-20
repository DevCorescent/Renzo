"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, User } from "lucide-react";

// Shared month calendar for upcoming bookings — used by the reception panel and
// the super-admin bookings page. All events are pre-fetched by the server page
// for a bounded window; this component only navigates/filters what it's given.

export type CalEvent = {
  id: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
  endTime: string;
  title: string;       // customer
  services: string;
  worker?: string | null;
  branch?: string | null;
  status: string;
  amount?: number | null;
  href?: string;
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  CHECKED_IN: "bg-violet-100 text-violet-700",
  STARTED: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-600",
  NO_SHOW: "bg-red-100 text-red-600",
  RESCHEDULED: "bg-gray-100 text-gray-600",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtLong(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export function BookingsCalendar({
  events,
  showBranch = false,
}: {
  events: CalEvent[];
  showBranch?: boolean;
}) {
  const todayStr = React.useMemo(() => {
    const n = new Date();
    return ymd(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const tomorrowStr = React.useMemo(() => {
    const n = new Date();
    n.setDate(n.getDate() + 1);
    return ymd(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [viewYear, setViewYear] = React.useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = React.useState(() => new Date().getMonth());
  const [selected, setSelected] = React.useState(todayStr);

  // date → events, sorted by start time.
  const byDate = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [events]);

  // Grid cells for the visible month (leading blanks + days).
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  }

  const selectedEvents = byDate.get(selected) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Calendar grid */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <CalendarDays className="size-4 text-gray-400" /> {monthLabel}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => {
                const n = new Date();
                setViewYear(n.getFullYear());
                setViewMonth(n.getMonth());
                setSelected(todayStr);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Today
            </button>
            <button onClick={() => shiftMonth(1)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Next month">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const ds = ymd(viewYear, viewMonth, day);
            const count = byDate.get(ds)?.length ?? 0;
            const isToday = ds === todayStr;
            const isSelected = ds === selected;
            const isPast = ds < todayStr;
            return (
              <button
                key={i}
                onClick={() => setSelected(ds)}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition ${
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : isToday
                      ? "border-gray-300 bg-gray-50 text-gray-900"
                      : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                } ${isPast && !isSelected ? "text-gray-300" : ""}`}
              >
                <span className={isToday && !isSelected ? "font-bold" : ""}>{day}</span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 min-w-4 rounded-full px-1 text-[9px] font-semibold leading-4 ${
                      isSelected ? "bg-white/25 text-white" : "bg-gray-900 text-white"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-gray-900" /> Has bookings</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full border border-gray-300 bg-gray-50" /> Today</span>
        </div>
      </div>

      {/* Selected-day list */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-800">
            {selected === todayStr ? "Today" : selected === tomorrowStr ? "Tomorrow" : fmtLong(selected).split(",")[0]}
          </p>
          <p className="text-xs text-gray-400">{fmtLong(selected)} · {selectedEvents.length} booking{selectedEvents.length === 1 ? "" : "s"}</p>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No bookings this day.</p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((e) => {
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs text-gray-500">
                      <Clock className="size-3" /> {e.startTime}–{e.endTime}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {e.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-500">{e.services}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                    {e.worker && <span className="inline-flex items-center gap-1"><User className="size-3" />{e.worker}</span>}
                    {showBranch && e.branch && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.branch}</span>}
                    {e.amount != null && <span className="text-gray-600">₹{e.amount.toLocaleString("en-IN")}</span>}
                  </div>
                </>
              );
              return e.href ? (
                <Link key={e.id} href={e.href} className="block rounded-lg border border-gray-100 p-3 transition hover:border-gray-300 hover:bg-gray-50">
                  {inner}
                </Link>
              ) : (
                <div key={e.id} className="rounded-lg border border-gray-100 p-3">{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
