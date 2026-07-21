"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

// Confirm a PENDING appointment (PENDING → CONFIRMED).
//
// A thin status-transition control over the EXISTING shared status route
// (PATCH /admin/appointments/[id]/status) — same pattern as CheckInButton, no new
// workflow and no hardcoded lifecycle beyond the one natural transition it offers.
// The route already enforces RBAC (SUPER_ADMIN / OWNER / BRANCH_ADMIN / RECEPTIONIST)
// and now fans out the confirmation notifications to the customer and assigned
// worker, so every screen that renders this button gets the same behaviour.
//
// Visible only while the appointment is PENDING — once confirmed (or further along)
// there is nothing to confirm, so it renders nothing rather than a dead button.
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

  if (status !== "PENDING") return null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.admin.appointmentStatus(appointmentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? "Could not confirm appointment");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm appointment");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2 py-0.5 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <CheckCheck className="size-3" aria-hidden="true" />}
        Confirm
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </span>
  );
}
