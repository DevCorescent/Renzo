"use client";

// Cancel a booking. PATCHes the shared appointment-status route (which already
// authorizes SUPER_ADMIN / OWNER / BRANCH_ADMIN / RECEPTIONIST) to CANCELLED, with
// a two-step inline confirm so a mis-click can't cancel someone's appointment.
// Only shown for statuses that can still be cancelled.

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const CANCELABLE = new Set(["PENDING", "CONFIRMED", "CHECKED_IN", "STARTED", "RESCHEDULED"]);

export function CancelBookingButton({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!CANCELABLE.has(status)) return null;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.admin.appointmentStatus(appointmentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not cancel");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
        >
          Keep
        </button>
        {error && <span className="text-[11px] text-red-500">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
    >
      <X className="size-3" aria-hidden="true" /> Cancel
    </button>
  );
}
