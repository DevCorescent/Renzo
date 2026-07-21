"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { ApiResponse } from "@/types/api";

// OWNER: Gauransh | MODULE: Appointments — Reschedule request (customer)
//
// The booking detail page had a Cancel control but no Reschedule one, even though
// the API (POST /customer/appointments/[id]/reschedule) has always existed — the
// option, date picker and time picker were simply never rendered. This restores
// them with the SAME inline pattern as CancelBookingButton: native date + time
// inputs (the same primitives EditAppointmentButton uses) plus the reason the API
// requires, submitting to that existing endpoint and refreshing the page.
//
// Reschedule is a REQUEST here: the server records a PENDING RescheduleRequest for
// the salon to approve — it does not move the appointment itself — so the UI
// confirms "requested", not "rescheduled". The server still owns every rule (your
// booking / reschedulable status / not in the past / one pending request at a time).
export function RescheduleBookingButton({
  appointmentId,
  currentDate,
  currentTime,
}: {
  appointmentId: string;
  currentDate: string; // YYYY-MM-DD
  currentTime: string; // HH:mm
}) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(currentDate);
  const [time, setTime] = React.useState(currentTime);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  // Today as YYYY-MM-DD, so the date picker won't offer past days. Only ever used
  // inside the (closed-by-default) form, so it never reaches the server HTML — no
  // hydration mismatch even if the request straddles midnight.
  const minDate = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setError("Pick a new date and time");
      return;
    }
    if (!reason.trim()) {
      setError("Please tell us why you're rescheduling");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API.customer.reschedule(appointmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate: date, newTime: time, reason: reason.trim() }),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) throw new Error(json.message || "Could not request reschedule");

      setDone(true);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request reschedule");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setError(null);
            setDate(currentDate);
            setTime(currentTime);
            setReason("");
            setOpen(true);
          }}
          className="text-xs text-stone-300 transition-colors hover:text-stone-100 hover:underline"
        >
          Reschedule
        </button>
        {done && (
          <p className="flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="size-3.5" /> Reschedule requested — pending approval
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-72 space-y-2 rounded-xl border border-white/8 bg-stone-900 p-3 text-left">
      <p className="text-sm font-medium text-stone-200">Request a new time</p>

      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => setDate(e.target.value)}
          aria-label="New date"
          className="w-full rounded-xl border border-white/8 bg-stone-950 px-2.5 py-2 text-sm text-stone-200 focus:border-amber-500/40 focus:outline-none"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="New time"
          className="w-full rounded-xl border border-white/8 bg-stone-950 px-2.5 py-2 text-sm text-stone-200 focus:border-amber-500/40 focus:outline-none"
        />
      </div>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Reason for rescheduling"
        className="w-full resize-none rounded-xl border border-white/8 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
      />

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <p className="text-[11px] text-stone-500">
        Current: {currentDate} · {currentTime}. Your request needs salon approval.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Requesting…" : "Request reschedule"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-full px-4 py-2 text-xs font-medium text-stone-500 transition hover:text-stone-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
