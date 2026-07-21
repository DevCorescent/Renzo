"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — Schedule tab
//
// Schedule is COMPUTED (shift ∪ availability ∪ bookings), so it is not part of the
// workspace's single Prisma batch — it reuses the existing scheduling engine via
// GET /api/v1/admin/workers/[id]/schedule instead of re-deriving it here. Fetched
// lazily, only when this tab is opened, so the workspace load stays cheap.
// ============================================================================

import * as React from "react";
import { Loader2, AlertTriangle, RefreshCw, CalendarClock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";

type ShiftInfo = {
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  workingDays: number[];
  isRosteredToday: boolean;
};
type ScheduleData = { shift: ShiftInfo | null };
type Envelope = { success: boolean; message: string; data?: ScheduleData };

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: ScheduleData };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleTab({ workerId }: { workerId: string }) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/v1/admin/workers/${workerId}/schedule`, { signal });
      const body = (await res.json()) as Envelope;
      if (!res.ok || !body.success || !body.data) {
        setPhase({ kind: "error", message: body.message || "Could not load the schedule" });
        return;
      }
      setPhase({ kind: "ready", data: body.data });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server." });
    }
  }, [workerId]);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => { await load(controller.signal); })();
    return () => controller.abort();
  }, [load]);

  if (phase.kind === "loading") {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-gray-400 dark:text-(--sa-muted)" /></div>;
  }
  if (phase.kind === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-12 text-center dark:border-red-500/20 dark:bg-red-500/10">
        <AlertTriangle className="size-5 text-red-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-gray-700 dark:text-(--sa-text-2)">{phase.message}</p>
        <button
          type="button"
          onClick={() => { setPhase({ kind: "loading" }); load(); }}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }

  const shift = phase.data.shift;
  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-(--sa-border) dark:bg-(--sa-surface)">
        <span className="flex size-11 items-center justify-center rounded-full bg-gray-50 text-gray-300 ring-1 ring-gray-200 dark:bg-white/5 dark:text-(--sa-muted) dark:ring-(--sa-border)"><CalendarClock className="size-5" /></span>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-(--sa-text-2)">No shift assigned</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-gray-400 dark:text-(--sa-muted)" />{shift.name}</CardTitle>
        {shift.isRosteredToday && <Badge tone="success">Rostered today</Badge>}
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Working hours" value={`${shift.startTime} – ${shift.endTime}`} />
          <Field label="Break" value={shift.breakStart && shift.breakEnd ? `${shift.breakStart} – ${shift.breakEnd}` : "None"} />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">Working days</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <span
                key={d}
                className={`inline-flex size-8 items-center justify-center rounded-full text-[11px] font-medium ${
                  shift.workingDays.includes(i) ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950" : "bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-(--sa-muted)"
                }`}
              >
                {d[0]}
              </span>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-3 dark:border-(--sa-border) dark:bg-white/5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-(--sa-text)">{value}</p>
    </div>
  );
}
