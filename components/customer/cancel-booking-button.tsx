"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const CANCELABLE = new Set(["PENDING", "CONFIRMED"]);

export function CustomerCancelBookingButton({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [reason, setReason] = React.useState("Customer requested cancellation");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!CANCELABLE.has(status)) return null;

  async function cancel() {
    if (!reason.trim()) {
      setError("Please provide a reason for cancellation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.customer.cancel(appointmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not cancel booking");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel booking");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-400 hover:underline"
      >
        Cancel booking
      </button>
    );
  }

  return (
    <div className="mt-2 w-64 rounded-xl border border-white/8 bg-stone-900 p-3 text-left">
      <p className="mb-2 text-xs font-medium text-stone-300">
        Reason for cancellation
      </p>
      <textarea
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(null); }}
        disabled={busy}
        rows={2}
        className="w-full resize-none rounded-lg border border-white/8 bg-stone-950 px-2.5 py-2 text-xs text-stone-200 placeholder:text-stone-600 focus:border-stone-400 focus:outline-none disabled:opacity-60"
      />
      {error && (
        <p className="mt-1 text-[11px] text-red-400">{error}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3 animate-spin" />}
          <X className="size-3" />
          Confirm cancel
        </button>
        <button
          type="button"
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={busy}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-stone-400 transition hover:bg-stone-800 disabled:opacity-60"
        >
          Keep booking
        </button>
      </div>
    </div>
  );
}
