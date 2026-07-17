"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { CheckInButton } from "@/components/reception/check-in-button";
import { AssignWorkerSelect } from "@/components/reception/assign-worker-select";
import { CancelBookingButton } from "@/components/appointments/cancel-booking-button";

export function QueueActions({
  appointmentId,
  status,
  workerId,
  invoiceId,
}: {
  appointmentId: string;
  status: string;
  workerId?: string | null;
  invoiceId?: string | null;
}) {
  const showBill = Boolean(invoiceId) || status === "COMPLETED";

  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <CheckInButton appointmentId={appointmentId} status={status} />
      <AssignWorkerSelect
        appointmentId={appointmentId}
        status={status}
        currentWorkerId={workerId}
      />
      {invoiceId ? (
        <Link
          href={`/reception/billing/${invoiceId}`}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
        >
          <Receipt className="size-3" aria-hidden="true" /> Bill
        </Link>
      ) : showBill ? (
        <Link
          href="/reception/billing"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
        >
          <Receipt className="size-3" aria-hidden="true" /> Bill
        </Link>
      ) : null}
      <CancelBookingButton appointmentId={appointmentId} status={status} />
    </div>
  );
}
