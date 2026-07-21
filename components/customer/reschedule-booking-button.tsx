"use client";

import * as React from "react";
import { CalendarDays, Loader2, Check } from "lucide-react";
import { API } from "@/lib/endpoints";

const RESCHEDULABLE = new Set(["PENDING", "CONFIRMED", "RESCHEDULED"]);

export function CustomerRescheduleButton({
  appointmentId,
  status,
  currentDate,
}: {
  appointmentId: string;
  status: string;
  /** ISO date string (YYYY-MM-DD) of the current appointment — used as min date */
  currentDate: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  if (!RESCHEDULABLE.has(status)) return null;

  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newTime || !reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.customer.reschedule(appointmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate, newTime, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not submit request");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
        <Check className="size-3.5" />
        Reschedule request sent — pending approval
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-[#C8A96A] hover:underline"
      >
        <CalendarDays className="size-3.5" />
        Reschedule
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 w-72 space-y-2 rounded-xl border border-white/8 bg-stone-900 p-3 text-left"
    >
      <p className="text-xs font-medium text-stone-300">Request a new time</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-stone-500">Date</label>
          <input
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => { setNewDate(e.target.value); setError(null); }}
            disabled={busy}
            required
            style={{ colorScheme: "dark" }}
            className="w-full rounded-lg border border-white/8 bg-stone-950 px-2 py-1.5 text-xs text-stone-200 focus:border-stone-400 focus:outline-none disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-stone-500">Time</label>
          <input
            type="time"
            value={newTime}
            onChange={(e) => { setNewTime(e.target.value); setError(null); }}
            disabled={busy}
            required
            style={{ colorScheme: "dark" }}
            className="w-full rounded-lg border border-white/8 bg-stone-950 px-2 py-1.5 text-xs text-stone-200 focus:border-stone-400 focus:outline-none disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-stone-500">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null); }}
          disabled={busy}
          rows={2}
          placeholder="Why do you need to reschedule?"
          className="w-full resize-none rounded-lg border border-white/8 bg-stone-950 px-2.5 py-2 text-xs text-stone-200 placeholder:text-stone-600 focus:border-stone-400 focus:outline-none disabled:opacity-60"
        />
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-[#C8A96A] px-3 py-1.5 text-xs font-semibold text-stone-950 transition hover:bg-[#E8CC88] disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3 animate-spin" />}
          Send request
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={busy}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-stone-400 transition hover:bg-stone-800 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
