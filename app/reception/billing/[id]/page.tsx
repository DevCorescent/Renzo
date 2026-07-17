import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { CollectPaymentForm } from "@/components/reception/collect-payment-form";

// OWNER: Hemant | MODULE: Reception — Invoice Detail

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  UNPAID: "warning", PARTIAL: "info", PAID: "success", REFUNDED: "neutral", CANCELLED: "danger",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card", ONLINE: "Online",
  WALLET: "Wallet", GIFT_CARD: "Gift Card", LOYALTY_POINTS: "Loyalty Points", MEMBERSHIP: "Membership",
};

export default async function ReceptionBillingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
      refunds: { orderBy: { processedAt: "desc" } },
      appointment: {
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
          worker: { select: { firstName: true, lastName: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      },
    },
  });

  if (!invoice || invoice.branchId !== authUser.branchId) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Invoice #{invoice.invoiceNo}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{new Date(invoice.createdAt).toLocaleString("en-IN")}</p>
        </div>
        <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>{invoice.status}</Badge>
      </div>

      {invoice.appointment && (
        <Card>
          <CardHeader><CardTitle>Customer & Appointment</CardTitle></CardHeader>
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-medium text-gray-900">
                  {invoice.appointment.customer.firstName} {invoice.appointment.customer.lastName}
                </p>
                <p className="text-xs text-gray-400">{invoice.appointment.customer.phone}</p>
                {invoice.appointment.customer.email && (
                  <p className="text-xs text-gray-400">{invoice.appointment.customer.email}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Worker</p>
                <p className="text-gray-700">
                  {invoice.appointment.worker
                    ? `${invoice.appointment.worker.firstName} ${invoice.appointment.worker.lastName}`
                    : "—"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {invoice.appointment.services.map((s) => s.service.name).join(", ") || "—"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Qty</th>
                <th className="px-4 py-2.5 text-right">Unit Price</th>
                <th className="px-4 py-2.5 text-right">Tax</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.type}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₹{Number(item.unitPrice).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-gray-500">₹{Number(item.taxAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{Number(item.total).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>₹{Number(invoice.subtotal).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax</span><span>₹{Number(invoice.taxAmount).toLocaleString("en-IN")}</span>
          </div>
          {Number(invoice.discountAmount) > 0 && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Discount</span><span>−₹{Number(invoice.discountAmount).toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span><span>₹{Number(invoice.totalAmount).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm text-green-700">
            <span>Paid</span><span>₹{Number(invoice.paidAmount).toLocaleString("en-IN")}</span>
          </div>
          {Number(invoice.balanceDue) > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-600">
              <span>Balance Due</span><span>₹{Number(invoice.balanceDue).toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>
      </Card>

      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{METHOD_LABEL[p.method] ?? p.method}</p>
                  <p className="text-xs text-gray-400">{new Date(p.paidAt).toLocaleString("en-IN")}</p>
                  {p.reference && <p className="text-[11px] text-gray-400">Ref: {p.reference}</p>}
                </div>
                <p className="text-sm font-semibold text-green-700">₹{Number(p.amount).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {invoice.refunds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Refunds</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {invoice.refunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{METHOD_LABEL[r.method] ?? r.method}</p>
                  <p className="text-xs text-gray-400">{r.reason}</p>
                  <p className="text-[11px] text-gray-400">{new Date(r.processedAt).toLocaleString("en-IN")}</p>
                </div>
                <p className="text-sm font-semibold text-red-600">−₹{Number(r.amount).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(invoice.status === "UNPAID" || invoice.status === "PARTIAL") && Number(invoice.balanceDue) > 0 && (
        <CollectPaymentForm invoiceId={invoice.id} balanceDue={Number(invoice.balanceDue)} />
      )}
    </div>
  );
}
