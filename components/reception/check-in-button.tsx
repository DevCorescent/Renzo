"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const CHECKINABLE = new Set(["PENDING", "CONFIRMED", "RESCHEDULED"]);

export function CheckInButton({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!CHECKINABLE.has(status)) return null;

  async function checkIn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.reception.checkin(appointmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not check in");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check in");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={checkIn}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" aria-hidden="true" />}
        Check in
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </span>
  );
}
