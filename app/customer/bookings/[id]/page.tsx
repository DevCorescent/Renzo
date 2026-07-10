import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import Link from "next/link";

// OWNER: Devanshi | MODULE: Customer — Booking Detail

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning",
  STARTED: "primary", COMPLETED: "success", CANCELLED: "danger",
  NO_SHOW: "danger", RESCHEDULED: "info",
};

export default async function CustomerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true, address: true, city: true, phone: true, mapUrl: true } },
      worker: { select: { firstName: true, lastName: true, designation: { select: { name: true } } } },
      services: { include: { service: { select: { name: true, duration: true } } } },
      addOns: { include: { addOn: { select: { name: true } } } },
      invoice: {
        select: {
          invoiceNo: true, status: true, totalAmount: true,
          paidAmount: true, balanceDue: true,
          payments: { select: { method: true, amount: true, paidAt: true } },
        },
      },
    },
  });

  if (!appointment || appointment.customerId !== authUser.customerId) notFound();

  const canCancel = ["PENDING", "CONFIRMED"].includes(appointment.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400">Appointment</p>
          <h1 className="text-xl font-semibold text-gray-900">#{appointment.appointmentNo}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date(appointment.appointmentDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}{appointment.startTime}–{appointment.endTime}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[appointment.status] ?? "neutral"}>{appointment.status.replace(/_/g, " ")}</Badge>
          {canCancel && (
            <span className="text-xs text-red-500 hover:underline cursor-pointer">Cancel booking</span>
          )}
        </div>
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
        {Number(appointment.discountAmount) > 0 && (
          <div className="border-t border-gray-100 px-4 py-2 flex justify-between text-xs text-green-700">
            <span>Discount</span><span>−₹{Number(appointment.discountAmount).toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3 flex justify-between text-sm font-semibold text-gray-900">
          <span>Total</span><span>₹{Number(appointment.totalAmount).toLocaleString("en-IN")}</span>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Stylist</CardTitle></CardHeader>
          <CardBody>
            {appointment.worker ? (
              <>
                <p className="font-medium text-gray-900">{appointment.worker.firstName} {appointment.worker.lastName}</p>
                <p className="text-xs text-gray-400">{appointment.worker.designation?.name}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Not assigned yet</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Location</CardTitle></CardHeader>
          <CardBody>
            <p className="font-medium text-gray-900">{appointment.branch.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{appointment.branch.address}, {appointment.branch.city}</p>
            <p className="text-xs text-gray-400">{appointment.branch.phone}</p>
            {appointment.branch.mapUrl && (
              <Link href={appointment.branch.mapUrl} target="_blank" className="mt-2 inline-block text-xs text-gray-500 hover:underline">
                View on map →
              </Link>
            )}
          </CardBody>
        </Card>
      </div>

      {appointment.invoice && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <Badge tone={appointment.invoice.status === "PAID" ? "success" : appointment.invoice.status === "PARTIAL" ? "info" : "warning"}>
              {appointment.invoice.status}
            </Badge>
          </CardHeader>
          <CardBody>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Total</span><span>₹{Number(appointment.invoice.totalAmount).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-green-700 font-medium">
                <span>Paid</span><span>₹{Number(appointment.invoice.paidAmount).toLocaleString("en-IN")}</span>
              </div>
              {Number(appointment.invoice.balanceDue) > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Due</span><span>₹{Number(appointment.invoice.balanceDue).toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {appointment.notes && (
        <Card>
          <CardHeader><CardTitle>Your Notes</CardTitle></CardHeader>
          <CardBody><p className="text-sm text-gray-600">{appointment.notes}</p></CardBody>
        </Card>
      )}

      <Link href="/customer/bookings" className="inline-block text-sm text-gray-500 hover:text-gray-800">
        ← Back to bookings
      </Link>
    </div>
  );
}
