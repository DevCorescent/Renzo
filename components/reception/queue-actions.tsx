"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { CheckInButton } from "@/components/reception/check-in-button";
import { AssignWorkerSelect } from "@/components/reception/assign-worker-select";
import { ConfirmAppointmentButton } from "@/components/appointments/confirm-appointment-button";
import { CancelBookingButton } from "@/components/appointments/cancel-booking-button";

// Kept in sync with BILLABLE_STATUSES in lib/billing-service.ts. It lives there
// too, but that module imports prisma, so a client component can't share it.
// CONFIRMED is billable so the desk can bill a counter booking without a check-in.
const BILLABLE_STATUSES = ["CONFIRMED", "CHECKED_IN", "STARTED", "COMPLETED"];

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
  // Show "Bill" the moment the customer has arrived — checked in, in-chair or
  // done — so the desk can jump straight to the ready-to-invoice list. Before,
  // this waited for COMPLETED, which the reception UI has no button to set.
  const showBill = Boolean(invoiceId) || BILLABLE_STATUSES.includes(status);

  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {/* Confirm a still-pending booking before check-in — shared status route. */}
      <ConfirmAppointmentButton appointmentId={appointmentId} status={status} />
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
