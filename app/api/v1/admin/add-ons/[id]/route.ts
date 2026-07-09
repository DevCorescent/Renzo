import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Add-ons
// ROUTE  : /api/v1/admin/add-ons/[id]
//
// METHODS
// GET    - Get Add-on By ID
// PATCH  - Update Add-on
// DELETE - Delete Add-on
//
// ACCESS
// GET    : SUPER_ADMIN, OWNER
// PATCH  : SUPER_ADMIN, OWNER
// DELETE : SUPER_ADMIN, OWNER
// ============================================================================

// ============================================================================
// Utility Functions
// ============================================================================

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function parseFiniteNumber(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : NaN;
}

/* ============================================================================
   GET /api/v1/admin/add-ons/[id]

   Returns a single add-on with its usage information.
============================================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Add-on ID is required");
    }

    const addOn = await prisma.addOn.findUnique({
      where: {
        id,
      },

      include: {
        serviceAddOns: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        appointmentAddOns: true,

        _count: {
          select: {
            serviceAddOns: true,
            appointmentAddOns: true,
          },
        },
      },
    });

    if (!addOn) {
      return err("Add-on not found", 404);
    }

    return ok(
      addOn,
      "Add-on fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Add-on Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   PATCH /api/v1/admin/add-ons/[id]

   Updates an existing add-on.
============================================================================ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Add-on ID is required");
    }

    const existingAddOn = await prisma.addOn.findUnique({
      where: {
        id,
      },
    });

    if (!existingAddOn) {
      return err("Add-on not found", 404);
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    if (Object.keys(body).length === 0) {
      return err("No fields provided to update");
    }

    const {
      name,
      description,
      price,
      duration,
      image,
      isActive,
    } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return err("Add-on name cannot be empty");
    }

    if (
      name !== undefined &&
      name.trim().length > 100
    ) {
      return err("Add-on name cannot exceed 100 characters");
    }

    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return err("isActive must be a boolean");
    }

    const parsedPrice =
      price !== undefined
        ? parseFiniteNumber(price)
        : existingAddOn.price;

    if (
      parsedPrice === null ||
      Number.isNaN(parsedPrice) ||
      parsedPrice < 0
    ) {
      return err("Valid price is required");
    }

    const parsedDuration =
      duration !== undefined
        ? parseFiniteNumber(duration)
        : existingAddOn.duration;

    if (
      parsedDuration === null ||
      Number.isNaN(parsedDuration) ||
      parsedDuration < 0
    ) {
      return err("Duration must be zero or greater");
    }

    // ------------------------------------------------------------------------
    // Duplicate Name Check
    // ------------------------------------------------------------------------

    const finalName =
      name?.trim() ??
      existingAddOn.name;

    const duplicate = await prisma.addOn.findFirst({
      where: {
        id: {
          not: id,
        },
        name: {
          equals: finalName,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      return err(
        "Add-on name already exists",
        409
      );
    }

    // ------------------------------------------------------------------------
    // Update Add-on
    // ------------------------------------------------------------------------

    const updatedAddOn = await prisma.addOn.update({
      where: {
        id,
      },

      data: {
        name: finalName,

        description:
          description !== undefined
            ? optionalTrimmedString(description) ?? null
            : existingAddOn.description,

        image:
          image !== undefined
            ? optionalTrimmedString(image) ?? null
            : existingAddOn.image,

        price: parsedPrice,

        duration: parsedDuration,

        isActive:
          isActive ??
          existingAddOn.isActive,
      },

      include: {
        _count: {
          select: {
            serviceAddOns: true,
            appointmentAddOns: true,
          },
        },
      },
    });

    return ok(
      updatedAddOn,
      "Add-on updated successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (error.code) {
        case "P2002":
          return err(
            "Add-on name already exists",
            409
          );

        case "P2025":
          return err(
            "Add-on not found",
            404
          );
      }
    }

    console.error(
      "PATCH Add-on Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   DELETE /api/v1/admin/add-ons/[id]

   Deletes an add-on if it is not linked with other records.
============================================================================ */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const { id } = await params;

    if (!id.trim()) {
      return err("Add-on ID is required");
    }

    // ------------------------------------------------------------------------
    // Check Add-on Exists
    // ------------------------------------------------------------------------

    const existingAddOn = await prisma.addOn.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            serviceAddOns: true,
            appointmentAddOns: true,
          },
        },
      },
    });

    if (!existingAddOn) {
      return err("Add-on not found", 404);
    }

    // ------------------------------------------------------------------------
    // Prevent deletion if linked with other records
    // ------------------------------------------------------------------------

    if (
      existingAddOn._count.serviceAddOns > 0 ||
      existingAddOn._count.appointmentAddOns > 0
    ) {
      return err(
        "Cannot delete add-on because it is linked with existing records",
        409
      );
    }

    // ------------------------------------------------------------------------
    // Delete Add-on
    // ------------------------------------------------------------------------

    await prisma.addOn.delete({
      where: {
        id,
      },
    });

    return ok(
      null,
      "Add-on deleted successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (error.code) {
        case "P2025":
          return err("Add-on not found", 404);

        case "P2003":
          return err(
            "Cannot delete add-on because it is referenced by other records",
            409
          );
      }
    }

    console.error(
      "DELETE Add-on Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}