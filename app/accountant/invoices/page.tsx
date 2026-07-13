import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "danger"> = {
  PAID: "success",
  PARTIAL: "info",
  UNPAID: "warning",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();

export default async function AccountantInvoicesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const branchFilter = authUser.branchId ? { branchId: authUser.branchId } : {};

  const invoices = await prisma.invoice.findMany({
    where: branchFilter,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, invoiceNo: true, totalAmount: true, paidAmount: true,
      balanceDue: true, status: true, createdAt: true, customerId: true,
    },
  });

  type InvoiceRaw = (typeof invoices)[number];
  type CustomerRaw = { id: string; firstName: string; lastName: string | null };

  const custIds = [...new Set(invoices.map((i: InvoiceRaw) => i.customerId))];
  const customers: CustomerRaw[] = custIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: custIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const custMap = new Map(customers.map((c: CustomerRaw) => [c.id, fullName(c.firstName, c.lastName)]));

  const totalRevenue = invoices.reduce((sum: number, i: InvoiceRaw) => sum + Number(i.paidAmount), 0);
  const outstanding = invoices
    .filter((i: InvoiceRaw) => ["UNPAID", "PARTIAL"].includes(i.status))
    .reduce((sum: number, i: InvoiceRaw) => sum + Number(i.balanceDue), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {invoices.length} invoices · ₹{Math.round(outstanding).toLocaleString("en-IN")} outstanding
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Invoices", value: invoices.length },
          { label: "Paid", value: invoices.filter((i: InvoiceRaw) => i.status === "PAID").length },
          { label: "Outstanding", value: `₹${Math.round(outstanding).toLocaleString("en-IN")}` },
          { label: "Revenue Collected", value: `₹${Math.round(totalRevenue).toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Invoice No.</TH>
              <TH>Customer</TH>
              <TH>Date</TH>
              <TH>Total</TH>
              <TH>Paid</TH>
              <TH>Balance Due</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No invoices yet.</td></tr>
            ) : invoices.map((i: InvoiceRaw) => (
              <TR key={i.id}>
                <TD className="font-mono text-xs font-medium text-gray-700">{i.invoiceNo}</TD>
                <TD className="text-gray-700">{custMap.get(i.customerId) ?? "—"}</TD>
                <TD className="text-xs text-gray-500">
                  {new Date(i.createdAt).toLocaleDateString("en-IN")}
                </TD>
                <TD className="font-medium text-gray-900">₹{Number(i.totalAmount).toLocaleString("en-IN")}</TD>
                <TD className="text-gray-700">₹{Number(i.paidAmount).toLocaleString("en-IN")}</TD>
                <TD className={Number(i.balanceDue) > 0 ? "font-medium text-amber-600" : "text-gray-400"}>
                  {Number(i.balanceDue) > 0 ? `₹${Number(i.balanceDue).toLocaleString("en-IN")}` : "—"}
                </TD>
                <TD><Badge tone={STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
