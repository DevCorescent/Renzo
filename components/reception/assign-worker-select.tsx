"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const ASSIGNABLE = new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "STARTED", "RESCHEDULED"]);

type Worker = { id: string; firstName: string; lastName: string };

export function AssignWorkerSelect({
  appointmentId,
  status,
  currentWorkerId,
}: {
  appointmentId: string;
  status: string;
  currentWorkerId?: string | null;
}) {
  const router = useRouter();
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ASSIGNABLE.has(status)) return;
    const ac = new AbortController();
    fetch(`${API.admin.workers}?limit=100&isActive=true`, { signal: ac.signal, credentials: "include" })
      .then((r) => r.json())
      .then((d) => setWorkers(d.data?.items ?? d.data ?? []))
      .catch(() => {});
    return () => ac.abort();
  }, [status]);

  if (!ASSIGNABLE.has(status)) return null;

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const workerId = e.target.value;
    if (!workerId || workerId === currentWorkerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.reception.assign(appointmentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workerId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not assign worker");
      }
      router.refresh();
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign worker");
      e.target.value = currentWorkerId ?? "";
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1">
        {busy && <Loader2 className="size-3 animate-spin text-gray-400" />}
        <select
          key={currentWorkerId ?? "unassigned"}
          defaultValue={currentWorkerId ?? ""}
          onChange={onChange}
          disabled={busy}
          className="max-w-[9.5rem] rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-gray-400 disabled:opacity-60"
          aria-label="Assign stylist"
        >
          <option value="">{currentWorkerId ? "Change stylist…" : "Assign stylist…"}</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id} disabled={w.id === currentWorkerId}>
              {w.firstName} {w.lastName}
            </option>
          ))}
        </select>
      </span>
      {error && <span className="max-w-[10rem] text-right text-[11px] text-red-500">{error}</span>}
    </span>
  );
}
