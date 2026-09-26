"use client";

// ============================================================================
// MODULE : Worker Workspace — Work History tab
//
// Shows a paginated list of all appointments this worker was assigned to.
// Fetches lazily — only loads when the tab is first opened.
// ============================================================================

import * as React from "react";
import { Loader2, AlertTriangle, RefreshCw, CalendarDays, ChevronRight } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  PENDING: "neutral",
  CONFIRMED: "neutral",
  CHECKED_IN: "warning",
  STARTED: "warning",
  RESCHEDULED: "warning",
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));

type ApptRow = {
  id: string;
  appointmentNo: string;
  appointmentDate: string;
  startTime: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  customerName: string;
  customerPhone: string | null;
  branchName: string;
  services: { name: string; price: number }[];
};

type Data = { items: ApptRow[]; total: number; page: number; totalPages: number };

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Data };

export function WorkHistoryTab({ workerId }: { workerId: string }) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("");

  const load = React.useCallback(async (pg: number, status: string, signal?: AbortSignal) => {
    setPhase({ kind: "loading" });
    try {
      const qs = new URLSearchParams({ page: String(pg), limit: "20" });
      if (status) qs.set("status", status);
      const res = await fetch(
        `${API.admin.workerWorkHistory(workerId)}?${qs.toString()}`,
        { signal }
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        setPhase({ kind: "error", message: body.message || "Could not load work history" });
        return;
      }
      setPhase({ kind: "ready", data: body.data as Data });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server." });
    }
  }, [workerId]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(page, statusFilter, controller.signal);
    return () => controller.abort();
  }, [load, page, statusFilter]);

  function handleFilterChange(s: string) {
    setStatusFilter(s);
    setPage(1);
  }

  if (phase.kind === "loading") {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-gray-400 dark:text-(--sa-muted)" /></div>;
  }
  if (phase.kind === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-12 text-center dark:border-red-500/20 dark:bg-red-500/10">
        <AlertTriangle className="size-5 text-red-400" />
        <p className="mt-2 text-sm text-gray-700 dark:text-(--sa-text-2)">{phase.message}</p>
        <button
          type="button"
          onClick={() => load(page, statusFilter)}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
        >
          <RefreshCw className="size-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { data } = phase;

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        {["", "COMPLETED", "CANCELLED", "NO_SHOW", "CONFIRMED", "PENDING"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleFilterChange(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === s
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-(--sa-border) dark:bg-(--sa-surface)">
          <CalendarDays className="size-8 text-gray-200 dark:text-(--sa-muted)" />
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-(--sa-text-2)">No appointments found</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Appointments ({data.total})</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100 dark:divide-(--sa-border)">
              {data.items.map((appt) => (
                <div key={appt.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-gray-400 dark:text-(--sa-muted)">{appt.appointmentNo}</span>
                        <Badge tone={STATUS_TONE[appt.status] ?? "neutral"}>
                          {appt.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                        {appt.customerName}
                        {appt.customerPhone && (
                          <span className="ml-2 text-xs font-normal text-gray-400">{appt.customerPhone}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
                        {fmtDate(appt.appointmentDate)}
                        {appt.startTime && ` · ${appt.startTime}`}
                        {appt.branchName && ` · ${appt.branchName}`}
                      </p>
                      {appt.services.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-(--sa-text-2)">
                          {appt.services.map((s) => s.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold text-gray-900 dark:text-(--sa-text)">{inr(appt.totalAmount)}</p>
                      {appt.discountAmount > 0 && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">−{inr(appt.discountAmount)} disc.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-(--sa-border)">
              <span className="text-xs text-gray-400">{data.total} total</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-40 dark:border-(--sa-border)"
                >
                  Prev
                </button>
                <span className="px-1 py-1 text-xs text-gray-500">{page} / {data.totalPages}</span>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-40 dark:border-(--sa-border)"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
