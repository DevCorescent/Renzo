"use client";

import * as React from "react";
import { Loader2, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

type HoursPayload = {
  assigned: boolean;
  startTime: string;
  endTime: string;
  workingDays: number[];
  breakStart: string | null;
  breakEnd: string | null;
};

type Envelope = { success: boolean; message: string; data?: HoursPayload };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timeInputCls =
  "h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:text-gray-400 dark:border-(--sa-border) dark:bg-(--sa-tile) dark:text-(--sa-text)";

export function WorkerHoursEditor({ endpoint }: { endpoint: string }) {
  const [hours, setHours] = React.useState<HoursPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { signal });
      const body = (await res.json()) as Envelope;
      if (!res.ok || !body.success || !body.data) {
        setError(body.message || "Could not load hours");
        setHours(null);
        return;
      }
      setHours(body.data);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load]);

  async function save() {
    if (!hours) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startTime: hours.startTime,
          endTime: hours.endTime,
          workingDays: hours.workingDays,
          breakStart: hours.breakStart || null,
          breakEnd: hours.breakEnd || null,
        }),
      });
      const body = (await res.json()) as Envelope;
      if (!res.ok || !body.success || !body.data) {
        setError(body.message || "Could not save hours");
        return;
      }
      setHours(body.data);
      setSaved(true);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(day: number) {
    setHours((prev) => {
      if (!prev) return prev;
      const has = prev.workingDays.includes(day);
      const workingDays = has
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b);
      return { ...prev, workingDays };
    });
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-gray-400 dark:text-(--sa-muted)" />
      </div>
    );
  }

  if (!hours) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-(--sa-muted)">
        {error ?? "No hours to show."}
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-gray-400 dark:text-(--sa-muted)" />
          Working hours
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-(--sa-muted)">
          Bookable times are the overlap of these hours and the branch opening
          hours. Days that are off here cannot be booked.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Start</span>
            <input
              type="time"
              value={hours.startTime}
              disabled={saving}
              onChange={(e) => {
                setHours({ ...hours, startTime: e.target.value });
                setSaved(false);
              }}
              className={timeInputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">End</span>
            <input
              type="time"
              value={hours.endTime}
              disabled={saving}
              onChange={(e) => {
                setHours({ ...hours, endTime: e.target.value });
                setSaved(false);
              }}
              className={timeInputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Break start</span>
            <input
              type="time"
              value={hours.breakStart ?? ""}
              disabled={saving}
              onChange={(e) => {
                setHours({ ...hours, breakStart: e.target.value || null });
                setSaved(false);
              }}
              className={timeInputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Break end</span>
            <input
              type="time"
              value={hours.breakEnd ?? ""}
              disabled={saving}
              onChange={(e) => {
                setHours({ ...hours, breakEnd: e.target.value || null });
                setSaved(false);
              }}
              className={timeInputCls}
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
            Working days
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((label, i) => {
              const on = hours.workingDays.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleDay(i)}
                  aria-pressed={on}
                  className={`inline-flex size-8 items-center justify-center rounded-full text-[11px] font-medium transition ${
                    on
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
                      : "bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-(--sa-muted)"
                  }`}
                >
                  {label[0]}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Hours saved.</p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || hours.workingDays.length === 0}
          className="inline-flex h-9 items-center justify-center rounded border border-gray-900 bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:border-white dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
        >
          {saving ? "Saving…" : "Save hours"}
        </button>
      </CardBody>
    </Card>
  );
}
