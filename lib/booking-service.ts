// ============================================================================
// MODULE : Appointments — the shared booking core
//
// THE booking engine. Extracted from the reception route when public GUEST
// booking needed the identical rules: branch validity, service pricing at the
// branch rate, worker qualification, worker overlap, branch holiday, advance-
// booking window and lead time.
//
// Both doors — the public website and the front desk — now call `createBooking()`.
// That is the point: an online booking and a walk-in must be the SAME record with
// the SAME checks, differing only in `source` and who is recorded as creating it.
// A second copy of this logic is how the public site eventually stops checking
// for double-bookings.
//
// Pure Prisma against existing models. No new tables.
// ============================================================================

import { AppointmentStatus, BookingSource, PaymentStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveCustomerForBooking } from "@/lib/customer-service";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function addMinutes(start: string, mins: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** `APT-20260803-4821`. Kept byte-identical to what reception produced before. */
export function appointmentNo(): string {
  const now = new Date();
  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  return `APT-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export type BookingInput = {
  branchId: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string | null;
  serviceIds: string[];
  workerId?: string | null;
  /** "YYYY-MM-DD". */
  appointmentDate: string;
  /** "HH:mm". */
  startTime: string;
  notes?: string | null;
  chairCabinNo?: string | null;
  roomNo?: string | null;
  /** A second stylist assisting. Does not own the slot, so it is not overlap-checked. */
  assistantWorkerId?: string | null;
};

export type BookingContext = {
  source: BookingSource;
  /** userId of the staff member booking, or null for a public guest booking. */
  createdByUserId: string | null;
  /**
   * Guest bookings land as PENDING unless the branch auto-confirms; the front
   * desk books someone standing at the counter, so those are CONFIRMED.
   */
  forceConfirmed: boolean;
};

export type BookingFailure = {
  ok: false;
  status: number;
  message: string;
  errors?: Record<string, string[]>;
};

export type BookingSuccess = {
  ok: true;
  appointment: Prisma.AppointmentGetPayload<{
    include: {
      customer: { select: { firstName: true; lastName: true; phone: true; email: true } };
      branch: { select: { name: true; address: true; phone: true } };
      worker: { select: { firstName: true; lastName: true } };
      services: { include: { service: { select: { name: true } } } };
    };
  }>;
};

const fail = (
  message: string,
  status = 400,
  errors?: Record<string, string[]>
): BookingFailure => ({ ok: false, status, message, errors });

/**
 * Validate and create an appointment.
 *
 * Returns a typed failure instead of throwing, so each route can map it onto its
 * own response envelope while the RULES stay in one place.
 */
export async function createBooking(
  input: BookingInput,
  context: BookingContext
): Promise<BookingSuccess | BookingFailure> {
  // ── Shape ────────────────────────────────────────────────────────────────
  const phone = input.customerPhone?.trim() ?? "";
  if (!phone) return fail("Customer phone is required", 422, { customerPhone: ["Required"] });

  const name = input.customerName?.trim() ?? "";
  if (!name) return fail("Customer name is required", 422, { customerName: ["Required"] });

  const serviceIds = [...new Set((input.serviceIds ?? []).filter(Boolean))];
  if (serviceIds.length === 0) {
    return fail("At least one service is required", 422, { serviceIds: ["Choose a service"] });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.appointmentDate ?? "")) {
    return fail("Invalid appointment date", 422, { appointmentDate: ["Must be YYYY-MM-DD"] });
  }
  const parsedDate = new Date(`${input.appointmentDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return fail("Invalid appointment date", 422, { appointmentDate: ["Invalid date"] });
  }

  const start = input.startTime?.trim() ?? "";
  if (!TIME_RE.test(start)) {
    return fail("Start time must be HH:mm", 422, { startTime: ["Must be HH:mm (e.g. 09:00)"] });
  }

  // ── Branch ───────────────────────────────────────────────────────────────
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: {
      id: true,
      isActive: true,
      setting: {
        select: {
          advanceBookingDays: true,
          minAdvanceBookingHours: true,
          autoConfirmBookings: true,
        },
      },
    },
  });
  if (!branch || !branch.isActive) return fail("Branch not found", 404);

  // ── Booking window ───────────────────────────────────────────────────────
  // Enforced HERE rather than in the UI, because the UI is not the authority —
  // a stale tab or a direct POST must hit the same rules.
  const settings = branch.setting;
  const slotStart = new Date(`${input.appointmentDate}T${start}:00.000Z`);
  const nowUtc = new Date();

  if (settings) {
    const leadMs = settings.minAdvanceBookingHours * 60 * 60 * 1000;
    // Salon-local "now" is +05:30; the slot is stored as a wall-clock string, so
    // both sides are compared in the same naive frame.
    const nowLocal = new Date(nowUtc.getTime() + 5.5 * 60 * 60 * 1000);
    if (slotStart.getTime() < nowLocal.getTime() + leadMs) {
      return fail(
        settings.minAdvanceBookingHours > 0
          ? `Bookings need at least ${settings.minAdvanceBookingHours} hour(s) notice`
          : "That time has already passed",
        409
      );
    }

    const horizon = new Date(nowLocal.getTime() + settings.advanceBookingDays * 86_400_000);
    if (slotStart.getTime() > horizon.getTime()) {
      return fail(`Bookings open only ${settings.advanceBookingDays} days ahead`, 409);
    }
  }

  // ── Branch holiday ───────────────────────────────────────────────────────
  const holiday = await prisma.branchHoliday.findFirst({
    where: { branchId: branch.id, date: parsedDate },
    select: { reason: true },
  });
  if (holiday) {
    return fail(
      `The branch is closed on this date${holiday.reason ? `: ${holiday.reason}` : ""}`,
      409
    );
  }

  // ── Services, priced at the branch rate ──────────────────────────────────
  const dbServices = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
    select: {
      id: true,
      duration: true,
      basePrice: true,
      branchPricings: {
        where: { branchId: branch.id, isActive: true },
        select: { price: true },
      },
    },
  });
  if (dbServices.length !== serviceIds.length) {
    return fail("One or more services are invalid or unavailable at this branch", 422, {
      serviceIds: ["Unavailable service"],
    });
  }

  let totalDuration = 0;
  let subtotal = 0;
  const serviceRows = dbServices.map((s) => {
    const price = Number(s.branchPricings[0]?.price ?? s.basePrice);
    totalDuration += s.duration;
    subtotal += price;
    return {
      serviceId: s.id,
      price,
      duration: s.duration,
      status: AppointmentStatus.PENDING,
    };
  });

  const endTime = addMinutes(start, totalDuration);

  // ── Worker (optional) ────────────────────────────────────────────────────
  let resolvedWorkerId: string | null = null;
  if (input.workerId) {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: input.workerId },
      select: {
        id: true,
        isActive: true,
        branches: { where: { branchId: branch.id, isActive: true }, select: { id: true } },
      },
    });
    if (!worker || !worker.isActive) return fail("Worker not found", 404);
    if (worker.branches.length === 0) {
      return fail("This worker is not assigned to the selected branch", 422);
    }

    const qualified = await prisma.workerService.count({
      where: { workerId: worker.id, serviceId: { in: serviceIds }, isActive: true },
    });
    if (qualified !== serviceIds.length) {
      return fail("This stylist does not offer one or more of the selected services", 422);
    }

    // Double-booking guard. Half-open comparison: an appointment ending exactly
    // when this one starts is NOT an overlap.
    const overlapping = await prisma.appointment.count({
      where: {
        workerId: worker.id,
        appointmentDate: parsedDate,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startTime: { lt: endTime },
        endTime: { gt: start },
      },
    });
    if (overlapping > 0) {
      return fail("The selected time slot is not available for this worker", 409);
    }

    resolvedWorkerId = worker.id;
  }

  // ── Assistant (optional) ─────────────────────────────────────────────────
  // Must belong to the branch, but is NOT overlap-checked: an assistant helps on
  // several chairs in a shift and does not own the slot the way the lead does.
  let resolvedAssistantId: string | null = null;
  if (input.assistantWorkerId) {
    if (input.assistantWorkerId === resolvedWorkerId) {
      return fail("The assistant must be someone other than the stylist", 422, {
        assistantWorkerId: ["Choose a different person"],
      });
    }
    const assistant = await prisma.workerProfile.findUnique({
      where: { id: input.assistantWorkerId },
      select: {
        id: true,
        isActive: true,
        branches: { where: { branchId: branch.id, isActive: true }, select: { id: true } },
      },
    });
    if (!assistant || !assistant.isActive || assistant.branches.length === 0) {
      return fail("Assistant not found at this branch", 422, {
        assistantWorkerId: ["Unknown or not assigned to this branch"],
      });
    }
    resolvedAssistantId = assistant.id;
  }

  // ── Chair / room double-booking ──────────────────────────────────────────
  // A chair holds one customer at a time. Same half-open overlap rule the worker
  // guard uses, so a booking ending exactly when this one starts is not a clash.
  for (const [field, value, label] of [
    ["chairCabinNo", input.chairCabinNo, "chair"],
    ["roomNo", input.roomNo, "room"],
  ] as const) {
    if (!value) continue;
    const clash = await prisma.appointment.count({
      where: {
        branchId: branch.id,
        [field]: value,
        appointmentDate: parsedDate,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startTime: { lt: endTime },
        endTime: { gt: start },
      },
    });
    if (clash > 0) {
      return fail(`That ${label} is already taken for this time`, 409, {
        [field]: [`${label} unavailable`],
      });
    }
  }

  // ── Customer ─────────────────────────────────────────────────────────────
  const resolved = await resolveCustomerForBooking({
    db: prisma,
    phone,
    name,
    branchId: branch.id,
    // A guest booking has no staff author; the customer created themselves.
    createdByUserId: context.createdByUserId ?? "",
  });
  if (!resolved.ok) return fail(resolved.message, 409);

  // A guest who gave an email keeps it — the confirmation is sent there.
  if (input.customerEmail) {
    await prisma.customer
      .update({
        where: { id: resolved.customerId },
        data: { email: input.customerEmail.trim().toLowerCase() },
      })
      // A clash with another account's email must not lose the booking.
      .catch(() => undefined);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const status = context.forceConfirmed
    ? AppointmentStatus.CONFIRMED
    : settings?.autoConfirmBookings === false
      ? AppointmentStatus.PENDING
      : AppointmentStatus.CONFIRMED;

  try {
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo: appointmentNo(),
        customerId: resolved.customerId,
        branchId: branch.id,
        workerId: resolvedWorkerId,
        status,
        source: context.source,
        appointmentDate: parsedDate,
        startTime: start,
        endTime,
        totalDuration,
        subtotal,
        // Tax is charged at INVOICE time from the branch's live rate, not frozen
        // onto the booking — see lib/billing-service.ts.
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: subtotal,
        paidAmount: 0,
        paymentStatus: PaymentStatus.PENDING,
        chairCabinNo: input.chairCabinNo ?? null,
        roomNo: input.roomNo ?? null,
        assistantWorkerId: resolvedAssistantId,
        notes: input.notes?.trim() || null,
        services: {
          create: serviceRows.map((r) => ({ ...r, workerId: resolvedWorkerId })),
        },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
        branch: { select: { name: true, address: true, phone: true } },
        worker: { select: { firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    });

    return { ok: true, appointment };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return fail("Appointment number clash, please retry", 409);
      if (e.code === "P2003") return fail("Invalid branch, worker, or service reference", 400);
    }
    throw e;
  }
}
