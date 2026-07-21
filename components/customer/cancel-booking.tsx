"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { ApiResponse } from "@/types/api";

// OWNER: Gauransh | MODULE: Appointments — Cancel booking (customer)
//
// The confirm-then-cancel control for a customer's own booking. The detail page
// only ever rendered a dead <span> here — it looked clickable but had no handler,
// so nothing happened. This restores the flow using the SAME pieces as the rest of
// the customer area: an inline confirmation (mirroring ReviewDialog, no new modal
// system), the existing POST /customer/appointments/[id]/cancel API, and
// router.refresh() to pull the new status back through the server component.
//
// The server still owns every rule — "your booking / cancellable status / not in
// the past" — this is only the form. That API requires a reason, so one is
// collected and required here too, mirroring how ReviewDialog mirrors its own
// server-side rules client-side.
export function CancelBookingButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please tell us why you're cancelling");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API.customer.cancel(appointmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) throw new Error(json.message || "Could not cancel booking");

      setOpen(false);
      router.refresh(); // pull the new CANCELLED status back through the server component
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel booking");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-400 transition-colors hover:underline"
      >
        Cancel booking
      </button>
    );
  }

  return (
    <form onSubmit={confirm} className="w-64 space-y-2 rounded-xl border border-white/8 bg-stone-900 p-3 text-left">
      <p className="text-sm font-medium text-stone-200">Cancel this booking?</p>
      <p className="text-xs text-stone-500">This can&rsquo;t be undone. Let us know why:</p>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Reason for cancellation"
        className="w-full resize-none rounded-xl border border-white/8 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
      />

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-400 disabled:opacity-60"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-full px-4 py-2 text-xs font-medium text-stone-500 transition hover:text-stone-300"
        >
          Keep booking
        </button>
      </div>
    </form>
  );
}
