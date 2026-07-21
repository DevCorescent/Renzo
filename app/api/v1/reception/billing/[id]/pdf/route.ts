import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { err } from "@/lib/response";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

// GET /api/v1/reception/billing/[id]/pdf
// Returns the invoice as a downloadable PDF.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER", "ACCOUNTANT");
  if (error) return error;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { select: { name: true, quantity: true, unitPrice: true, total: true } },
      },
    });
    if (!invoice) return err("Invoice not found", 404);

    const [customer, branch] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: invoice.customerId },
        select: { firstName: true, lastName: true },
      }),
      prisma.branch.findUnique({
        where: { id: invoice.branchId },
        select: { name: true },
      }),
    ]);

    const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(invoice.createdAt);

    const buffer = await generateInvoicePdf({
      invoiceNo: invoice.invoiceNo,
      date,
      branch: branch?.name ?? "",
      customerName: `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() || "Customer",
      items: invoice.items.map((item) => ({
        label: `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
        amount: Number(item.total),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discountAmount),
      tax: Number(invoice.taxAmount),
      total: Number(invoice.totalAmount),
      paid: Number(invoice.paidAmount),
      balance: Number(invoice.balanceDue),
      method: "",
    });

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${invoice.invoiceNo}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[PDF] Failed to generate invoice PDF:", e);
    return err("Failed to generate PDF", 500);
  }
}
