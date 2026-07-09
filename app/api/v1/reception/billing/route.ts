import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import type { InvoiceStatus, Prisma } from "@prisma/client";

type NewItem = {
  type: string;
  refId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

// OWNER: Shalmon | MODULE: Reception Billing
// GET /api/v1/reception/billing — Invoice list for the reception desk
// Defaults to the logged-in staff member's branch; admins may pass ?branchId=
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");
    const branchId = url.searchParams.get("branchId") ?? user.branchId;

    const where: Prisma.InvoiceWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as InvoiceStatus } : {}),
      ...(search ? { invoiceNo: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true, payments: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/reception/billing — Generate an invoice from an appointment
// Body: { appointmentId, discountAmount?, notes? }
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const appointmentId: string =
      typeof body.appointmentId === "string" ? body.appointmentId : "";
    if (!appointmentId) {
      return err("Validation failed", 422, { appointmentId: ["appointmentId is required"] });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        invoice: true,
        services: { include: { service: { select: { name: true } } } },
        addOns: { include: { addOn: { select: { name: true } } } },
        packages: { include: { package: { select: { name: true } } } },
      },
    });

    if (!appointment) return err("Appointment not found", 404);
    if (appointment.invoice) {
      return err("An invoice already exists for this appointment", 409);
    }
    if (appointment.status === "CANCELLED") {
      return err("Cannot bill a cancelled appointment", 409);
    }

    // One invoice line per booked service / add-on / package.
    const items: NewItem[] = [
      ...appointment.services.map((s) => ({
        type: "SERVICE",
        refId: s.serviceId,
        name: s.service.name,
        quantity: 1,
        unitPrice: s.price,
        total: s.price,
      })),
      ...appointment.addOns.map((a) => ({
        type: "ADDON",
        refId: a.addOnId,
        name: a.addOn.name,
        quantity: 1,
        unitPrice: a.price,
        total: a.price,
      })),
      ...appointment.packages.map((p) => ({
        type: "PACKAGE",
        refId: p.packageId,
        name: p.package.name,
        quantity: 1,
        unitPrice: p.price,
        total: p.price,
      })),
    ];

    if (items.length === 0) {
      return err("Appointment has no billable services", 422);
    }

    // Prefer the booked line totals; tax carries over from the appointment.
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxAmount = appointment.taxAmount ?? 0;
    const discountAmount =
      body.discountAmount != null ? Number(body.discountAmount) : appointment.discountAmount ?? 0;

    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return err("Validation failed", 422, { discountAmount: ["Must be a non-negative number"] });
    }

    const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
    const paidAmount = appointment.paidAmount ?? 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);
    const status: InvoiceStatus =
      balanceDue <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: genCode("INV"),
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        branchId: appointment.branchId,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paidAmount,
        balanceDue,
        status,
        notes: typeof body.notes === "string" ? body.notes : null,
        generatedBy: user.userId,
        items: {
          create: items.map((i) => ({
            type: i.type,
            refId: i.refId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
      },
      include: { items: true },
    });

    return created(invoice, "Invoice generated");
  } catch {
    return err("Internal server error", 500);
  }
}
