import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Invoices
// GET /api/v1/admin/invoices/[id] — Invoice detail with items, payments, refunds
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "ACCOUNTANT");
  if (error) return error;

  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, payments: true, refunds: true },
    });
    if (!invoice) return err("Invoice not found", 404);
    return ok(invoice);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/invoices/[id] — Update status / notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "ACCOUNTANT");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return err("Invoice not found", 404);

    const data: { status?: string; notes?: string } = {};
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.notes === "string") data.notes = body.notes;
    if (Object.keys(data).length === 0) return err("Nothing to update", 422);

    const invoice = await prisma.invoice.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    });
    return ok(invoice, "Invoice updated");
  } catch {
    return err("Internal server error", 500);
  }
}
