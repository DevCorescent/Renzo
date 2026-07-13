import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// Optional 1–5 sub-rating.
function subRating(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// OWNER: Shalmon | MODULE: Customer Reviews
// GET /api/v1/customer/reviews — Own submitted reviews
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    const where = { customerId: user.customerId };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          branch: { select: { name: true } },
          worker: { select: { displayName: true, firstName: true, lastName: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/customer/reviews — Submit a review for a completed appointment
// Body: { appointmentId, overallRating, comment?, serviceRating?, workerRating?,
//         branchRating?, cleanliness?, punctuality?, images? }
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);
  const customerId = user.customerId;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const appointmentId: string = typeof body.appointmentId === "string" ? body.appointmentId : "";
    const overallRating = Number(body.overallRating);

    const errors: Record<string, string[]> = {};
    if (!appointmentId) errors.appointmentId = ["appointmentId is required"];
    if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
      errors.overallRating = ["overallRating must be an integer between 1 and 5"];
    }
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { services: { select: { serviceId: true } } },
    });
    if (!appointment) return err("Appointment not found", 404);
    if (appointment.customerId !== customerId) {
      return err("Forbidden — appointment belongs to another customer", 403);
    }
    if (appointment.status !== "COMPLETED") {
      return err("You can only review a completed appointment", 409);
    }

    // One review per appointment per customer.
    const existing = await prisma.review.findFirst({ where: { appointmentId, customerId } });
    if (existing) return err("You have already reviewed this appointment", 409);

    const review = await prisma.review.create({
      data: {
        appointmentId,
        customerId,
        branchId: appointment.branchId,
        workerId: appointment.workerId,
        serviceId: appointment.services[0]?.serviceId ?? null,
        overallRating,
        serviceRating: subRating(body.serviceRating),
        workerRating: subRating(body.workerRating),
        branchRating: subRating(body.branchRating),
        cleanliness: subRating(body.cleanliness),
        punctuality: subRating(body.punctuality),
        comment: typeof body.comment === "string" ? body.comment : null,
        images: Array.isArray(body.images) ? body.images.filter((i: unknown) => typeof i === "string") : [],
        // Reviews stay hidden until an admin approves them.
        status: "PENDING",
        isPublic: false,
      },
    });

    return created(review, "Review submitted — pending moderation");
  } catch {
    return err("Internal server error", 500);
  }
}
