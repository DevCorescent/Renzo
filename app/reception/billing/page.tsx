import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

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

  const invoices = await prisma.invoice.findMany({
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
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-0.5 text-sm text-gray-500">Recent {invoices.length} invoices</p>
      </div>

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
                  <TD className="font-mono text-xs text-gray-400">{inv.invoiceNo}</TD>
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
