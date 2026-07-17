import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { BookingActions } from "@/components/worker/bookings/booking-actions";
import { EditAppointmentButton } from "@/components/appointments/edit-appointment-button";

// OWNER: Hemant | MODULE: Worker — Booking Detail

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning",
  STARTED: "primary", COMPLETED: "success", CANCELLED: "danger",
  NO_SHOW: "danger", RESCHEDULED: "info",
};

export default async function WorkerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      branch: { select: { id: true, name: true, address: true, city: true, phone: true } },
      services: { include: { service: { select: { id: true, name: true, duration: true } } } },
      addOns: { include: { addOn: { select: { name: true, price: true } } } },
      invoice: { select: { invoiceNo: true, status: true, totalAmount: true, paidAmount: true } },
      rescheduleRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!appointment || appointment.workerId !== authUser.workerId) notFound();

  const hasPendingReschedule = appointment.rescheduleRequests.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Appointment #{appointment.appointmentNo}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date(appointment.appointmentDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}{appointment.startTime}–{appointment.endTime}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[appointment.status] ?? "neutral"}>{appointment.status.replace(/_/g, " ")}</Badge>
          <EditAppointmentButton
            appointmentId={appointment.id}
            status={appointment.status}
            appointmentDate={appointment.appointmentDate}
            startTime={appointment.startTime}
            endTime={appointment.endTime}
            branchId={appointment.branch.id}
            serviceId={appointment.services[0]?.service.id}
            workerId={appointment.workerId}
            mode="worker"
          />
        </div>
      </div>

      <BookingActions
        appointmentId={appointment.id}
        status={appointment.status}
        hasPendingReschedule={hasPendingReschedule}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardBody>
            <p className="font-medium text-gray-900">{appointment.customer.firstName} {appointment.customer.lastName}</p>
            <p className="text-sm text-gray-500">{appointment.customer.phone}</p>
            {appointment.customer.email && <p className="text-xs text-gray-400">{appointment.customer.email}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Branch</CardTitle></CardHeader>
          <CardBody>
            <p className="font-medium text-gray-900">{appointment.branch.name}</p>
            <p className="text-xs text-gray-500">{appointment.branch.address}, {appointment.branch.city}</p>
            <p className="text-xs text-gray-400">{appointment.branch.phone}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Services</CardTitle></CardHeader>
        <div className="divide-y divide-gray-50">
          {appointment.services.map((s) => (
            <div key={s.id} className="flex justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{s.service.name}</p>
                <p className="text-xs text-gray-400">{s.service.duration} min</p>
              </div>
              <p className="text-sm text-gray-700">₹{Number(s.price).toLocaleString("en-IN")}</p>
            </div>
          ))}
          {appointment.addOns.map((a) => (
            <div key={a.id} className="flex justify-between px-4 py-3">
              <p className="text-sm text-gray-600">{a.addOn.name} <span className="text-xs text-gray-400">(add-on)</span></p>
              <p className="text-sm text-gray-700">₹{Number(a.price).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>₹{Number(appointment.totalAmount).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </Card>

      {appointment.notes && (
        <Card>
          <CardHeader><CardTitle>Customer Notes</CardTitle></CardHeader>
          <CardBody><p className="text-sm text-gray-700">{appointment.notes}</p></CardBody>
        </Card>
      )}

      {appointment.invoice && (
        <Card>
          <CardHeader><CardTitle>Invoice</CardTitle></CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-gray-700">#{appointment.invoice.invoiceNo}</p>
                <p className="text-xs text-gray-400">Paid: ₹{Number(appointment.invoice.paidAmount).toLocaleString("en-IN")} of ₹{Number(appointment.invoice.totalAmount).toLocaleString("en-IN")}</p>
              </div>
              <Badge tone={appointment.invoice.status === "PAID" ? "success" : appointment.invoice.status === "PARTIAL" ? "info" : "warning"}>
                {appointment.invoice.status}
              </Badge>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
