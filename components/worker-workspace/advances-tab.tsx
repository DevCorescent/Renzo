"use client";

// ============================================================================
// MODULE : Worker Workspace — Advances tab
//
// Shows salary advance and repayment records for this worker. Fetches lazily
// (same pattern as ScheduleTab). Includes a form to record a new entry.
// ============================================================================

import * as React from "react";
import { Loader2, AlertTriangle, RefreshCw, TrendingDown, TrendingUp, IndianRupee, Plus, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";

const inr = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));

type AdvanceRow = {
  id: string;
  amount: number;
  type: "ADVANCE" | "REPAYMENT";
  reason: string | null;
  notes: string | null;
  givenBy: string | null;
  createdAt: string;
  branch: { name: string };
};

type Summary = { totalAdvances: number; totalRepayments: number; outstanding: number };

type Data = {
  items: AdvanceRow[];
  total: number;
  page: number;
  totalPages: number;
  summary: Summary;
};

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Data };

export function AdvancesTab({ workerId }: { workerId: string }) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [page, setPage] = React.useState(1);
  const [showForm, setShowForm] = React.useState(false);

  const load = React.useCallback(async (pg: number, signal?: AbortSignal) => {
    setPhase({ kind: "loading" });
    try {
      const res = await fetch(
        `${API.admin.workerAdvances(workerId)}?page=${pg}&limit=15`,
        { signal }
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        setPhase({ kind: "error", message: body.message || "Could not load advances" });
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
    void load(page, controller.signal);
    return () => controller.abort();
  }, [load, page]);

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
          onClick={() => load(page)}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
        >
          <RefreshCw className="size-3.5" /> Retry
        </button>
      </div>
    );
  }

  const { data } = phase;
  const { summary } = data;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<TrendingDown className="size-4 text-red-500" />} label="Total Advances" value={inr(summary.totalAdvances)} tone="red" />
        <SummaryCard icon={<TrendingUp className="size-4 text-emerald-500" />} label="Total Repaid" value={inr(summary.totalRepayments)} tone="green" />
        <SummaryCard
          icon={<IndianRupee className="size-4 text-amber-500" />}
          label="Outstanding"
          value={inr(summary.outstanding)}
          tone={summary.outstanding > 0 ? "amber" : "green"}
        />
      </div>

      {/* Record new form */}
      <div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
          >
            <Plus className="size-3.5" /> Record advance / repayment
          </button>
        ) : (
          <NewAdvanceForm
            workerId={workerId}
            onSaved={() => { setShowForm(false); setPage(1); load(1); }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>

      {/* Records list */}
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-(--sa-border) dark:bg-(--sa-surface)">
          <IndianRupee className="size-8 text-gray-200 dark:text-(--sa-muted)" />
          <p className="mt-3 text-sm font-medium text-gray-600 dark:text-(--sa-text-2)">No advance records</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-gray-100 dark:divide-(--sa-border)">
              {data.items.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={row.type === "ADVANCE" ? "danger" : "success"}>
                        {row.type === "ADVANCE" ? "Advance" : "Repayment"}
                      </Badge>
                      <span className="text-xs text-gray-400 dark:text-(--sa-muted)">{fmtDate(row.createdAt)}</span>
                    </div>
                    {row.reason && <p className="mt-1 text-sm text-gray-700 dark:text-(--sa-text-2)">{row.reason}</p>}
                    {row.notes && <p className="mt-0.5 text-xs text-gray-400 dark:text-(--sa-muted)">{row.notes}</p>}
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-(--sa-muted)">{row.branch.name}</p>
                  </div>
                  <p className={`shrink-0 text-base font-semibold tabular-nums ${row.type === "ADVANCE" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {row.type === "ADVANCE" ? "−" : "+"}{inr(row.amount)}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-(--sa-border)">
              <span className="text-xs text-gray-400">{data.total} records</span>
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

function SummaryCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "red" | "green" | "amber";
}) {
  const bg = { red: "bg-red-50 dark:bg-red-500/10", green: "bg-emerald-50 dark:bg-emerald-500/10", amber: "bg-amber-50 dark:bg-amber-500/10" }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${bg}`}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-white/10">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-(--sa-text)">{value}</p>
      </div>
    </div>
  );
}

function NewAdvanceForm({
  workerId,
  onSaved,
  onCancel,
}: {
  workerId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = React.useState<"ADVANCE" | "REPAYMENT">("ADVANCE");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid positive amount"); return; }
    setLoading(true);
    try {
      const res = await fetch(API.admin.workerAdvances(workerId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: amt, reason: reason || null, notes: notes || null }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) { setError(body.message ?? "Failed to save"); return; }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-(--sa-border) dark:bg-(--sa-surface)">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-800 dark:text-(--sa-text)">New record</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:text-(--sa-muted)"><X className="size-4" /></button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-(--sa-muted)">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "ADVANCE" | "REPAYMENT")}
            className="w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
          >
            <option value="ADVANCE">Advance (money given)</option>
            <option value="REPAYMENT">Repayment (paid back)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-(--sa-muted)">Amount (₹) *</label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-(--sa-muted)">Reason</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Medical emergency, festival advance…"
            className="w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-(--sa-muted)">Notes (internal)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any internal notes…"
            className="w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-(--sa-border) dark:text-(--sa-text-2)"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
