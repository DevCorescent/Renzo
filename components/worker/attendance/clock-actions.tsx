"use client";

// OWNER: Hemant | MODULE: Worker Attendance — clock in / out
// POST /api/v1/worker/attendance with { action: "CHECK_IN" | "CHECK_OUT" }

import * as React from "react";
import { useRouter } from "next/navigation";

type ApiEnvelope = {
  success: boolean;
  message?: string;
};

const btnPrimary =
  "inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white " +
  "transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function ClockActions({
  checkedIn,
  checkedOut,
}: {
  checkedIn: boolean;
  checkedOut: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"CHECK_IN" | "CHECK_OUT" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canClockIn = !checkedIn;
  const canClockOut = checkedIn && !checkedOut;

  async function postAction(action: "CHECK_IN" | "CHECK_OUT") {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      const res = await fetch("/api/v1/worker/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as ApiEnvelope;
      if (!res.ok || !body.success) {
        setError(body.message || `Could not ${action === "CHECK_IN" ? "clock in" : "clock out"}`);
        return;
      }
      setToast(body.message || (action === "CHECK_IN" ? "Clocked in" : "Clocked out"));
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canClockIn && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void postAction("CHECK_IN")}
            className={btnPrimary}
          >
            {busy === "CHECK_IN" ? "Clocking in…" : "Clock in"}
          </button>
        )}
        {canClockOut && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void postAction("CHECK_OUT")}
            className={btnPrimary}
          >
            {busy === "CHECK_OUT" ? "Clocking out…" : "Clock out"}
          </button>
        )}
        {checkedIn && !checkedOut && (
          <span className="text-sm text-gray-500">You are clocked in.</span>
        )}
        {checkedIn && checkedOut && (
          <span className="text-sm text-gray-500">You are clocked out for today.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {toast && (
        <p className="rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
          {toast}
        </p>
      )}
    </div>
  );
}
