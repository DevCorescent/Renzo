// ============================================================================
// MODULE : Public booking — GUEST appointments
// ROUTE  : /api/v1/public/appointments
//
// METHOD
//   POST — Book an appointment from the public website with NO account and NO
//          sign-in. { branchId, serviceIds, workerId?, appointmentDate,
//          startTime, customerName, customerPhone, customerEmail?, notes? }
//
// THE BUG THIS FIXES
// ------------------
// There was no public booking endpoint at all. The website's wizard posted to
// /api/v1/customer/appointments, which is `requireAuth(req, "CUSTOMER")` — so the
// last step of every public booking was a forced OTP or Google login, and a
// visitor who did not want an account simply could not book.
//
// A branch that genuinely wants sign-in sets `BranchSetting.requireLoginToBook`;
// otherwise guests book freely, which is the default.
//
// NO AUTH BY DESIGN. What protects it instead:
//   • every field is validated by the SAME lib/booking-service.ts the front desk
//     uses — conflict detection, worker qualification, branch holidays, the
//     advance-booking window and the lead time all still apply;
//   • prices come from the branch's own pricing, never from the request;
//   • the customer is resolved by phone through the shared resolver, so a repeat
//     guest lands on their existing profile rather than a duplicate;
//   • a guest cannot set status, source, amounts, or anybody else's data.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { created, err } from "@/lib/response";
import { validate, readJson } from "@/lib/validate";
import prisma from "@/lib/db";
import { createBooking } from "@/lib/booking-service";
import { PHONE_RE } from "@/lib/customer-schema";
import { logNotification } from "@/lib/notification-log";

const GuestBookingSchema = z.object({
  branchId: z.string().trim().min(1, "Choose a branch"),
  serviceIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one service").max(10),
  workerId: z.string().trim().min(1).nullable().optional(),
  appointmentDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:mm"),
  customerName: z.string().trim().min(1, "Your name is required").max(80),
  customerPhone: z
    .string()
    .trim()
    .regex(PHONE_RE, "Enter a valid mobile number"),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .nullable()
    .optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = validate(GuestBookingSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    // Does this branch insist on an account? Checked before anything is written.
    const branch = await prisma.branch.findFirst({
      where: { id: input.branchId, isActive: true, isPublic: true },
      select: {
        id: true,
        name: true,
        setting: { select: { requireLoginToBook: true } },
      },
    });
    if (!branch) return err("Branch not found", 404);

    if (branch.setting?.requireLoginToBook) {
      return err(
        "This branch requires you to sign in before booking",
        401,
        { login: ["Sign in to continue"] }
      );
    }

    const result = await createBooking(
      {
        branchId: branch.id,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        serviceIds: input.serviceIds,
        workerId: input.workerId ?? null,
        appointmentDate: input.appointmentDate,
        startTime: input.startTime,
        notes: input.notes ?? null,
      },
      {
        source: "ONLINE",
        // A guest authored this themselves — there is no staff member to credit.
        createdByUserId: null,
        // Honour the branch's autoConfirmBookings rather than forcing CONFIRMED
        // the way the front desk does for someone standing at the counter.
        forceConfirmed: false,
      }
    );

    if (!result.ok) {
      return err(result.message, result.status, result.errors);
    }

    const appointment = result.appointment;

    // Best-effort: never let a logging failure lose a confirmed booking.
    await logNotification({
      customerId: appointment.customerId,
      trigger: "APPOINTMENT_BOOKED",
      message: `Appointment ${appointment.appointmentNo} confirmed at ${branch.name}.`,
      refId: appointment.id,
    });

    // Deliberately narrow: a public response must not echo internal ids or
    // anything about other customers.
    return created(
      {
        id: appointment.id,
        appointmentNo: appointment.appointmentNo,
        status: appointment.status,
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalDuration: appointment.totalDuration,
        totalAmount: appointment.totalAmount,
        branch: appointment.branch,
        worker: appointment.worker,
        services: appointment.services.map((s) => ({
          name: s.service.name,
          price: s.price,
        })),
        customer: {
          firstName: appointment.customer.firstName,
          lastName: appointment.customer.lastName,
          phone: appointment.customer.phone,
        },
      },
      "Appointment booked"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
