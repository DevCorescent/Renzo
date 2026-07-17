import Link from "next/link";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { GenerateInvoiceButton } from "@/components/reception/generate-invoice-button";

// OWNER: Hemant | MODULE: Reception Billing

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

export default async function ReceptionBillingPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const [invoices, unbilled] = await Promise.all([
    prisma.invoice.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        appointment: {
          select: {
            appointmentNo: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        branchId,
        status: "COMPLETED",
        invoice: { is: null },
      },
      orderBy: { completedAt: "desc" },
      take: 30,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-0.5 text-sm text-gray-500">Recent {invoices.length} invoices</p>
      </div>

      {unbilled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to invoice</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <TH>Appt #</TH>
                <TH>Customer</TH>
                <TH>Service</TH>
                <TH>Total</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </THead>
            <tbody>
              {unbilled.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-400">{a.appointmentNo}</TD>
                  <TD className="font-medium text-gray-900">
                    {a.customer.firstName} {a.customer.lastName}
                    <p className="text-[11px] font-normal text-gray-400">{a.customer.phone}</p>
                  </TD>
                  <TD className="text-gray-600 text-xs">
                    {a.services.map((s) => s.service.name).join(", ") || "—"}
                  </TD>
                  <TD className="text-gray-700">₹{Number(a.totalAmount).toLocaleString("en-IN")}</TD>
                  <TD className="text-right">
                    <GenerateInvoiceButton appointmentId={a.id} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Invoice #</TH>
              <TH>Customer</TH>
              <TH>Date</TH>
              <TH>Total</TH>
              <TH>Paid</TH>
              <TH>Balance</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-mono text-xs">
                    <Link
                      href={`/reception/billing/${inv.id}`}
                      className="text-gray-700 underline-offset-2 hover:underline"
                    >
                      {inv.invoiceNo}
                    </Link>
                  </TD>
                  <TD className="font-medium text-gray-900">
                    {inv.appointment?.customer.firstName} {inv.appointment?.customer.lastName}
                    {inv.appointment?.customer.phone && (
                      <p className="text-[11px] font-normal text-gray-400">
                        {inv.appointment.customer.phone}
                      </p>
                    )}
                  </TD>
                  <TD className="font-mono text-xs text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-gray-700">₹{Number(inv.totalAmount).toLocaleString("en-IN")}</TD>
                  <TD className="text-green-700">₹{Number(inv.paidAmount).toLocaleString("en-IN")}</TD>
                  <TD className={Number(inv.balanceDue) > 0 ? "text-red-600" : "text-gray-400"}>
                    ₹{Number(inv.balanceDue).toLocaleString("en-IN")}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>
                      {inv.status}
                    </Badge>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
