"use client";

import * as React from "react";
import { CalendarDays, Clock, X } from "lucide-react";
import { BookingsTable, type BookingRow } from "@/components/dashboard/bookings-table";

// OWNER: Devanshi | Booking history + date/time calendar filter (client, UI-only)
export function BookingDateTimeFilter({ rows }: { rows: BookingRow[] }) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (date) {
        const d = new Date(r.dateSort);
        const sel = new Date(`${date}T00:00:00`);
        if (
          d.getFullYear() !== sel.getFullYear() ||
          d.getMonth() !== sel.getMonth() ||
          d.getDate() !== sel.getDate()
        ) return false;
      }
      if (time) {
        const start = r.time.slice(0, 5); // "HH:MM"
        if (start < time) return false;
      }
      return true;
    });
  }, [rows, date, time]);

  const inputCls =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition focus:border-[#C4C9D1] focus:ring-2 focus:ring-[#C4C9D1]/20 dark:border-(--sa-border) dark:bg-(--sa-tile) dark:text-(--sa-text) dark:[color-scheme:dark]";

  return (
    <div>
      {/* Date + Time + Calendar filter bar */}
      <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-4 py-3 dark:border-(--sa-border)">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-(--sa-muted)">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-(--sa-muted)">
          <span className="flex items-center gap-1"><Clock className="size-3.5" /> Time from</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </label>

        {(date || time) && (
          <button
            type="button"
            onClick={() => { setDate(""); setTime(""); }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 dark:text-(--sa-muted) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)"
          >
            <X className="size-3.5" /> Clear
          </button>
        )}

        <span className="ml-auto self-center text-xs text-gray-400 dark:text-(--sa-muted)">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <BookingsTable rows={filtered} />
    </div>
  );
}
