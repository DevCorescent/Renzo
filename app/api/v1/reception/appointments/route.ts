import { NextRequest } from "next/server";
import { AppointmentStatus, BookingSource, PaymentStatus, Prisma } from "@prisma/client";

import { created, err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import { createBooking } from "@/lib/booking-service";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Reception Appointments
// ROUTE  : /api/v1/reception/appointments
//
// METHODS
// GET - Today's Appointment List
//
// ACCESS
// RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDayRange(dateStr?: string): [Date, Date] {
  const base = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${base}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return [start, end];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const url = new URL(req.url);

    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "10"), 1),
      100
    );
    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status");
    const paymentStatus = url.searchParams.get("paymentStatus");
    const workerId = url.searchParams.get("workerId");
    const branchId = url.searchParams.get("branchId");
    const appointmentDate = url.searchParams.get("appointmentDate");

    const where: Prisma.AppointmentWhereInput = {};

    // ------------------------------------------------------------------------
    // Branch Restriction
    // ------------------------------------------------------------------------

    if (user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN") {
      if (!isNonEmptyString(user.branchId)) {
        return err("Your account is not assigned to a branch", 403);
      }
      where.branchId = user.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------
    if (search) {
      where.OR = [
        { appointmentNo: { contains: search, mode: "insensitive" } },
        { customer: { is: { firstName: { contains: search, mode: "insensitive" } } } },
        { customer: { is: { lastName: { contains: search, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: search } } } },
      ];
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      where.status = status as AppointmentStatus;
    }

    if (
      paymentStatus &&
      Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
    ) {
      where.paymentStatus = paymentStatus as PaymentStatus;
    }

    if (workerId) {
      where.workerId = workerId;
    }

    // ------------------------------------------------------------------------
    // Appointment Date
    // ------------------------------------------------------------------------

    if (appointmentDate) {
      if (!DATE_RE.test(appointmentDate)) {
        return err("Invalid appointmentDate format. Use YYYY-MM-DD");
      }
      const [start, end] = utcDayRange(appointmentDate);
      where.appointmentDate = { gte: start, lt: end };
    } else {
      const [start, end] = utcDayRange();
      where.appointmentDate = { gte: start, lt: end };
    }

    // ------------------------------------------------------------------------
    // Fetch Appointments
    // ------------------------------------------------------------------------

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startTime: "asc" }, { createdAt: "desc" }],
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          branch: { select: { id: true, name: true } },
          worker: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
          services: {
            include: {
              service: { select: { id: true, name: true } },
              variant: { select: { id: true, name: true } },
            },
          },
          packages: { include: { package: { select: { id: true, name: true } } } },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          _count: { select: { services: true, packages: true, addOns: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginated(appointments, total, page, limit, "Appointments fetched successfully");
  } catch (error) {
    console.error("GET Reception Appointments Error:", error);
    return err("Internal server error", 500);
  }
}

// ============================================================================
// POST /api/v1/reception/appointments — Create Walk-in Appointment
//
// The booking RULES (pricing at the branch rate, worker qualification, overlap /
// double-booking, branch holidays, the advance-booking window) now live in
// lib/booking-service.ts and are shared verbatim with the public guest-booking
// route. This handler supplies only identity, branch scope and source — which is
// what stops the website and the front desk from validating differently.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN (own branch) · SUPER_ADMIN, OWNER (any)
// ============================================================================

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid request body");

    // A scoped role books at their OWN branch and cannot name another's; a
    // platform role must say which branch.
    const branchId = scope.isGlobal
      ? isNonEmptyString(body.branchId)
        ? (body.branchId as string)
        : undefined
      : scope.branchId ?? undefined;
    if (!branchId) return err("branchId is required", 422);

    // Every rule — conflict detection, worker qualification, branch holidays, the
    // booking window — lives in lib/booking-service.ts and is shared with the
    // public guest-booking route. This handler only supplies identity and source.
    const result = await createBooking(
      {
        branchId,
        customerName: isNonEmptyString(body.customerName) ? (body.customerName as string) : "",
        customerPhone: isNonEmptyString(body.customerPhone) ? (body.customerPhone as string) : "",
        serviceIds: Array.isArray(body.serviceIds) ? (body.serviceIds as string[]) : [],
        workerId: isNonEmptyString(body.workerId) ? (body.workerId as string) : null,
        appointmentDate: isNonEmptyString(body.appointmentDate)
          ? (body.appointmentDate as string).slice(0, 10)
          : "",
        startTime: isNonEmptyString(body.startTime) ? (body.startTime as string) : "",
        notes: isNonEmptyString(body.notes) ? (body.notes as string) : null,
        chairCabinNo: isNonEmptyString(body.chairCabinNo) ? (body.chairCabinNo as string) : null,
        roomNo: isNonEmptyString(body.roomNo) ? (body.roomNo as string) : null,
        assistantWorkerId: isNonEmptyString(body.assistantWorkerId)
          ? (body.assistantWorkerId as string)
          : null,
        serviceWorkers:
          body.serviceWorkers &&
          typeof body.serviceWorkers === "object" &&
          !Array.isArray(body.serviceWorkers)
            ? (body.serviceWorkers as Record<string, string>)
            : undefined,
      },
      {
        source: BookingSource.WALK_IN,
        createdByUserId: user.userId,
        // The customer is standing at the desk — no pending state to confirm.
        forceConfirmed: true,
      }
    );

    if (!result.ok) return err(result.message, result.status, result.errors);

    // Auto-log each service to the Sheet under the assigned worker so the
    // branch admin can see at a glance who did what and for how much.
    // Non-fatal: a sheet write failure must never block the booking response.
    try {
      const apptDate = result.appointment.appointmentDate;

      // Group service entries by workerId.
      const workerEntries: Record<string, string[]> = {};
      for (const svc of result.appointment.services) {
        const wId = svc.workerId;
        if (!wId) continue;
        const price = Number(svc.price ?? 0);
        const entry = `${svc.service.name} · ₹${price}`;
        if (!workerEntries[wId]) workerEntries[wId] = [];
        workerEntries[wId].push(entry);
      }

      if (Object.keys(workerEntries).length > 0) {
        const existing = await prisma.sheetLog.findUnique({
          where: { branchId_date: { branchId, date: apptDate } },
          select: { cells: true },
        });

        const raw = (existing?.cells ?? {}) as Record<string, unknown>;
        const cells: Record<string, string[]> = {};

        // Carry forward all existing worker values.
        for (const [k, v] of Object.entries(raw)) {
          const arr = Array.isArray(v)
            ? (v as unknown[]).filter((x): x is string => typeof x === "string")
            : typeof v === "string" && v.trim() ? [v] : [];
          if (arr.length) cells[k] = arr;
        }

        // Append new entries for each worker.
        for (const [wId, entries] of Object.entries(workerEntries)) {
          cells[wId] = [...(cells[wId] ?? []), ...entries];
        }

        const cellsJson = cells as unknown as import("@prisma/client").Prisma.InputJsonValue;
        await prisma.sheetLog.upsert({
          where: { branchId_date: { branchId, date: apptDate } },
          create: { branchId, date: apptDate, cells: cellsJson },
          update: { cells: cellsJson },
        });
      }
    } catch (sheetErr) {
      console.error("Sheet auto-log error (non-fatal):", sheetErr);
    }

    await writeAudit(user, {
      action: "CREATE",
      module: "APPOINTMENT",
      refId: result.appointment.id,
      refType: "Appointment",
      newValue: {
        appointmentNo: result.appointment.appointmentNo,
        branchId,
        source: "WALK_IN",
        date: result.appointment.appointmentDate.toISOString().slice(0, 10),
        startTime: result.appointment.startTime,
        totalAmount: result.appointment.totalAmount,
      },
    });

    return created(result.appointment, "Walk-in appointment booked successfully");
  } catch (e) {
    console.error("POST Reception Appointment Error:", e);
    return err("Internal server error", 500);
  }
}
