"use client";

// Inline date/time editor for appointments. Used by super-admin, branch-admin,
// and workers. Loads live slot status so already-booked times show as Booked.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const EDITABLE = new Set([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "RESCHEDULED",
]);

type SlotEntry = { time: string; status: "AVAILABLE" | "BOOKED" | "PAST" };

function toDateInput(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EditAppointmentButton({
  appointmentId,
  status,
  appointmentDate,
  startTime,
  endTime,
  branchId,
  serviceId,
  workerId,
  mode = "admin",
}: {
  appointmentId: string;
  status: string;
  appointmentDate: string | Date;
  startTime: string;
  endTime: string;
  branchId?: string | null;
  serviceId?: string | null;
  workerId?: string | null;
  mode?: "admin" | "worker";
}) {
  const router = useRouter();
  const canEdit = EDITABLE.has(status);
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(toDateInput(appointmentDate));
  const [time, setTime] = React.useState(startTime);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slotGrid, setSlotGrid] = React.useState<SlotEntry[] | null>(null);
  const [slotsLoading, setSlotsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!canEdit || !open || !branchId || !serviceId || !date) {
      setSlotGrid(null);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    const q = new URLSearchParams({
      branchId,
      serviceId,
      date,
    });
    if (workerId) q.set("workerId", workerId);

    fetch(`${API.public.slots}?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const grid: SlotEntry[] =
          j.data?.slotGrid ??
          (j.data?.slots ?? []).map((t: string) => ({
            time: t,
            status: "AVAILABLE" as const,
          }));
        setSlotGrid(grid.filter((s) => s.status !== "PAST"));
      })
      .catch(() => {
        if (!cancelled) setSlotGrid(null);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canEdit, open, branchId, serviceId, workerId, date]);

  if (!canEdit) return null;

  async function save() {
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url =
        mode === "worker"
          ? API.worker.appointment(appointmentId)
          : API.admin.appointment(appointmentId);
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentDate: date,
          startTime: time,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.message ?? "Could not update appointment");
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDate(toDateInput(appointmentDate));
          setTime(startTime);
          setError(null);
          setBusy(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
      >
        <CalendarClock className="size-3" aria-hidden="true" /> Edit
      </button>
    );
  }

  return (
    <div className="inline-flex max-w-xs flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-800 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
        />
        {!slotGrid ? (
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-800 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)]"
          />
        ) : null}
      </div>

      {slotsLoading ? (
        <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">
          <Loader2 className="size-3 animate-spin" /> Loading slots…
        </p>
      ) : slotGrid && slotGrid.length > 0 ? (
        <div className="grid max-h-28 grid-cols-3 gap-1 overflow-y-auto">
          {slotGrid.map((s) => {
            const booked = s.status === "BOOKED";
            const isCurrent =
              date === toDateInput(appointmentDate) && s.time === startTime;
            const blocked = booked && !isCurrent;
            const selected = time === s.time;
            return (
              <button
                key={s.time}
                type="button"
                disabled={blocked}
                onClick={() => setTime(s.time)}
                className={`rounded px-1 py-1 text-[10px] font-medium ${
                  blocked
                    ? "cursor-not-allowed bg-gray-100 text-gray-400 line-through"
                    : selected
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
                }`}
                title={blocked ? "Booked" : s.time}
              >
                {s.time}
                {blocked ? " · Booked" : ""}
              </button>
            );
          })}
        </div>
      ) : branchId && serviceId ? (
        <p className="text-[11px] text-gray-400">No open slots this day</p>
      ) : null}

      <p className="text-[10px] text-gray-400 dark:text-[var(--sa-muted)]">
        Current {toDateInput(appointmentDate)} · {startTime}–{endTime}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={busy || !time}
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
        >
          Cancel
        </button>
      </div>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
