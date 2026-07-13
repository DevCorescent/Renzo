import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { created, err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Add-ons
// ROUTE  : /api/v1/admin/add-ons
//
// METHODS
// GET  - List Add-ons
// POST - Create Add-on
//
// ACCESS
// GET  : SUPER_ADMIN, OWNER
// POST : SUPER_ADMIN, OWNER
// ============================================================================

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

/* ============================================================================
   GET /api/v1/admin/add-ons
============================================================================ */

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
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
    const isActive = url.searchParams.get("isActive");

    const where: Prisma.AddOnWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (isActive === "true") where.isActive = true;
    if (isActive === "false") where.isActive = false;

    const [addOns, total] = await Promise.all([
      prisma.addOn.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          _count: { select: { serviceAddOns: true, appointmentAddOns: true } },
        },
      }),
      prisma.addOn.count({ where }),
    ]);

    return paginated(addOns, total, page, limit, "Add-ons fetched successfully");
  } catch (error) {
    console.error("GET Add-ons Error:", error);
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/admin/add-ons
============================================================================ */

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { name, description, price, duration, image, isActive = true } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!name || typeof name !== "string" || !name.trim()) {
      return err("Add-on name is required");
    }

    if (name.trim().length > 100) {
      return err("Add-on name cannot exceed 100 characters");
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return err("isActive must be a boolean");
    }

    const parsedPrice = parseFiniteNumber(price);
    if (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return err("Valid price is required");
    }

    // duration is optional and defaults to 0 — explicit null/undefined/""
    // are all treated the same way (fall back to 0), only a genuinely
    // invalid non-empty value (e.g. "abc" or a negative number) is rejected.
    const parsedDuration =
      duration === undefined || duration === null || duration === ""
        ? 0
        : parseFiniteNumber(duration);

    if (parsedDuration === null || Number.isNaN(parsedDuration) || parsedDuration < 0) {
      return err("Duration must be zero or greater");
    }

    // ------------------------------------------------------------------------
    // Duplicate Check
    // ------------------------------------------------------------------------

    const existingAddOn = await prisma.addOn.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });

    if (existingAddOn) {
      return err("Add-on name already exists", 409);
    }

    // ------------------------------------------------------------------------
    // Create Add-on
    // ------------------------------------------------------------------------

    const addOn = await prisma.addOn.create({
      data: {
        name: name.trim(),
        description: optionalTrimmedString(description) ?? null,
        image: optionalTrimmedString(image) ?? null,
        price: parsedPrice,
        duration: parsedDuration,
        isActive,
      },
      include: {
        _count: { select: { serviceAddOns: true, appointmentAddOns: true } },
      },
    });

    return created(addOn, "Add-on created successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return err("Add-on name already exists", 409);
      }
    }

    console.error("POST Add-on Error:", error);
    return err("Internal server error", 500);
  }
}