import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";
import Link from "next/link";

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
          invoiceNo: true, status: true, totalAmount: true, paidAmount: true, balanceDue: true,
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
          <p className="text-xs text-stone-500">Appointment</p>
          <h1 className="text-xl font-semibold text-stone-100">#{appointment.appointmentNo}</h1>
          <p className="mt-0.5 text-sm text-stone-400">
            {new Date(appointment.appointmentDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}{appointment.startTime}–{appointment.endTime}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[appointment.status] ?? "neutral"}>{appointment.status.replace(/_/g, " ")}</Badge>
          {canCancel && (
            <span className="text-xs text-red-400 hover:underline cursor-pointer">Cancel booking</span>
          )}
        </div>
      </div>

      {/* Services */}
      <div className="rounded-xl border border-white/8 bg-stone-900">
        <div className="border-b border-white/8 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-200">Services</h2>
        </div>
        <div className="divide-y divide-white/5">
          {appointment.services.map((s) => (
            <div key={s.id} className="flex justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-100">{s.service.name}</p>
                <p className="text-xs text-stone-500">{s.service.duration} min</p>
              </div>
              <p className="text-sm text-stone-300">₹{Number(s.price).toLocaleString("en-IN")}</p>
            </div>
          ))}
          {appointment.addOns.map((a) => (
            <div key={a.id} className="flex justify-between px-4 py-3">
              <p className="text-sm text-stone-300">{a.addOn.name} <span className="text-xs text-stone-500">(add-on)</span></p>
              <p className="text-sm text-stone-300">₹{Number(a.price).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
        {Number(appointment.discountAmount) > 0 && (
          <div className="border-t border-white/8 px-4 py-2 flex justify-between text-xs text-emerald-400">
            <span>Discount</span><span>−₹{Number(appointment.discountAmount).toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="border-t border-white/8 px-4 py-3 flex justify-between text-sm font-semibold text-stone-100">
          <span>Total</span><span>₹{Number(appointment.totalAmount).toLocaleString("en-IN")}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Stylist */}
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Stylist</h2>
          {appointment.worker ? (
            <>
              <p className="font-medium text-stone-100">{appointment.worker.firstName} {appointment.worker.lastName}</p>
              <p className="text-xs text-stone-500 mt-0.5">{appointment.worker.designation?.name}</p>
            </>
          ) : (
            <p className="text-sm text-stone-500">Not assigned yet</p>
          )}
        </div>

        {/* Location */}
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Location</h2>
          <p className="font-medium text-stone-100">{appointment.branch.name}</p>
          <p className="text-xs text-stone-500 mt-0.5">{appointment.branch.address}, {appointment.branch.city}</p>
          <p className="text-xs text-stone-500">{appointment.branch.phone}</p>
          {appointment.branch.mapUrl && (
            <Link href={appointment.branch.mapUrl} target="_blank" className="mt-2 inline-block text-xs text-gold hover:underline">
              View on map →
            </Link>
          )}
        </div>
      </div>

      {/* Payment */}
      {appointment.invoice && (
        <div className="rounded-xl border border-white/8 bg-stone-900">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-200">Payment</h2>
            <Badge tone={appointment.invoice.status === "PAID" ? "success" : appointment.invoice.status === "PARTIAL" ? "info" : "warning"}>
              {appointment.invoice.status}
            </Badge>
          </div>
          <div className="space-y-1.5 p-4 text-sm">
            <div className="flex justify-between text-stone-400">
              <span>Total</span><span>₹{Number(appointment.invoice.totalAmount).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between font-medium text-emerald-400">
              <span>Paid</span><span>₹{Number(appointment.invoice.paidAmount).toLocaleString("en-IN")}</span>
            </div>
            {Number(appointment.invoice.balanceDue) > 0 && (
              <div className="flex justify-between font-semibold text-red-400">
                <span>Due</span><span>₹{Number(appointment.invoice.balanceDue).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {appointment.notes && (
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Your Notes</h2>
          <p className="text-sm text-stone-400">{appointment.notes}</p>
        </div>
      )}

      <Link href="/customer/bookings" className="inline-block text-sm text-stone-500 hover:text-stone-200 transition-colors">
        ← Back to bookings
      </Link>
    </div>
  );
}
