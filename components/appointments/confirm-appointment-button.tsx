"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

const CONFIRMABLE = new Set(["PENDING", "RESCHEDULED"]);

export function ConfirmAppointmentButton({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!CONFIRMABLE.has(status)) return null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.admin.appointmentStatus(appointmentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not confirm");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-transparent dark:text-emerald-400 dark:hover:bg-emerald-500/10"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" aria-hidden="true" />}
        Confirm
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </span>
  );
}
