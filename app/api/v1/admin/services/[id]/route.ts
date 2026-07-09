import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Services
// ROUTE  : /api/v1/admin/services/[id]
//
// METHODS
// GET    - Get Service By ID
// PATCH  - Update Service
// DELETE - Delete Service
//
// ACCESS
// GET    : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PATCH  : SUPER_ADMIN, OWNER
// DELETE : SUPER_ADMIN, OWNER
// ============================================================================

const VALID_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

type Gender = (typeof VALID_GENDERS)[number];

function isValidGender(value: unknown): value is Gender {
  return typeof value === "string" && VALID_GENDERS.includes(value as Gender);
}

function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalIdOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/* ============================================================================
   GET /api/v1/admin/services/[id]
============================================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    if (!id.trim()) {
      return err("Service ID is required");
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        variants: { orderBy: { price: "asc" } },
        branchPricings: {
          include: { branch: { select: { id: true, name: true } } },
        },
        serviceAddOns: { include: { addOn: true } },
        requiredProducts: {
          include: { product: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            workerServices: true,
            appointmentServices: true,
            packageServices: true,
          },
        },
      },
    });

    if (!service) {
      return err("Service not found", 404);
    }

    return ok(service, "Service fetched successfully");
  } catch (error) {
    console.error("GET Service Error:", error);
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PATCH /api/v1/admin/services/[id]
============================================================================ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    if (!id.trim()) {
      return err("Service ID is required");
    }

    const existingService = await prisma.service.findUnique({ where: { id } });
    if (!existingService) {
      return err("Service not found", 404);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const {
      name,
      categoryId,
      subCategoryId,
      description,
      image,
      basePrice,
      duration,
      bufferTime,
      gender,
      taxPercent,
      isPopular,
      isActive,
      sortOrder,
    } = body;

    if (Object.keys(body).length === 0) {
      return err("No fields provided to update");
    }

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return err("Service name cannot be empty");
    }

    // categoryId, if provided, must actually be a non-empty string before
    // we ever call .trim() on it — previously an unguarded categoryId?.trim()
    // would throw on a non-string value and surface as a 500 instead of 400.
    if (
      categoryId !== undefined &&
      (typeof categoryId !== "string" || !categoryId.trim())
    ) {
      return err("Category ID must be a non-empty string");
    }

    if (gender !== undefined && !isValidGender(gender)) {
      return err("Invalid gender");
    }

    const parsedBasePrice =
      basePrice !== undefined ? parseFiniteNumber(basePrice) : Number(existingService.basePrice);
    if (parsedBasePrice === null || parsedBasePrice < 0) {
      return err("Valid base price is required");
    }

    const parsedDuration =
      duration !== undefined ? parseFiniteNumber(duration) : existingService.duration;
    if (parsedDuration === null || parsedDuration <= 0) {
      return err("Valid duration is required");
    }

    const parsedBufferTime =
      bufferTime !== undefined ? parseFiniteNumber(bufferTime) : existingService.bufferTime;
    if (parsedBufferTime === null || parsedBufferTime < 0) {
      return err("Buffer time must be zero or greater");
    }

    const parsedTax =
      taxPercent !== undefined ? parseFiniteNumber(taxPercent) : Number(existingService.taxPercent);
    if (parsedTax === null || parsedTax < 0) {
      return err("Invalid tax percentage");
    }

    const parsedSortOrder =
      sortOrder !== undefined ? parseFiniteNumber(sortOrder) : existingService.sortOrder;
    if (parsedSortOrder === null) {
      return err("Invalid sort order");
    }

    // ------------------------------------------------------------------------
    // Generate slug if name changes
    // ------------------------------------------------------------------------

    const finalName = name?.trim() ?? existingService.name;
    const slug = toSlug(finalName);
    if (!slug) {
      return err("Service name must contain at least one letter or number");
    }

    // ------------------------------------------------------------------------
    // Validate Category (now safe — type already checked above)
    // ------------------------------------------------------------------------

    const finalCategoryId: string =
      categoryId !== undefined ? categoryId.trim() : existingService.categoryId;

    const category = await prisma.serviceCategory.findUnique({
      where: { id: finalCategoryId },
    });

    if (!category) {
      return err("Selected category does not exist", 404);
    }

    // ------------------------------------------------------------------------
    // Validate Sub Category
    // ------------------------------------------------------------------------

    const finalSubCategoryId =
      subCategoryId !== undefined
        ? optionalIdOrNull(subCategoryId)
        : existingService.subCategoryId;

    if (finalSubCategoryId) {
      const subCategory = await prisma.serviceSubCategory.findUnique({
        where: { id: finalSubCategoryId },
      });

      if (!subCategory) {
        return err("Selected sub category does not exist", 404);
      }

      if (subCategory.categoryId !== finalCategoryId) {
        return err("Sub category does not belong to selected category");
      }
    }

    // ------------------------------------------------------------------------
    // Duplicate Name / Slug Checks
    // ------------------------------------------------------------------------

    const [duplicateName, duplicateSlug] = await Promise.all([
      prisma.service.findFirst({
        where: { id: { not: id }, name: { equals: finalName, mode: "insensitive" } },
      }),
      prisma.service.findFirst({
        where: { id: { not: id }, slug },
      }),
    ]);

    if (duplicateName) {
      return err("Service name already exists", 409);
    }
    if (duplicateSlug) {
      return err("Service slug already exists", 409);
    }

    // ------------------------------------------------------------------------
    // Update Service
    // ------------------------------------------------------------------------

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        name: finalName,
        slug,
        categoryId: finalCategoryId,
        subCategoryId: finalSubCategoryId,
        description:
          description !== undefined
            ? optionalTrimmedString(description) ?? null
            : existingService.description,
        image:
          image !== undefined ? optionalTrimmedString(image) ?? null : existingService.image,
        basePrice: parsedBasePrice,
        duration: parsedDuration,
        bufferTime: parsedBufferTime,
        gender: gender ?? existingService.gender,
        taxPercent: parsedTax,
        isPopular: isPopular !== undefined ? Boolean(isPopular) : existingService.isPopular,
        isActive: isActive !== undefined ? Boolean(isActive) : existingService.isActive,
        sortOrder: parsedSortOrder,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
      },
    });

    return ok(updatedService, "Service updated successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return err("Service name or slug already exists", 409);
        case "P2003":
          return err("Invalid category or sub category supplied", 400);
        case "P2025":
          return err("Service not found", 404);
      }
    }

    console.error("PATCH Service Error:", error);
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   DELETE /api/v1/admin/services/[id]
============================================================================ */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    if (!id.trim()) {
      return err("Service ID is required");
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            variants: true,
            branchPricings: true,
            workerServices: true,
            packageServices: true,
            serviceAddOns: true,
            requiredProducts: true,
            appointmentServices: true,
          },
        },
      },
    });

    if (!service) {
      return err("Service not found", 404);
    }

    const counts = service._count;
    if (
      counts.variants > 0 ||
      counts.branchPricings > 0 ||
      counts.workerServices > 0 ||
      counts.packageServices > 0 ||
      counts.serviceAddOns > 0 ||
      counts.requiredProducts > 0 ||
      counts.appointmentServices > 0
    ) {
      return err("Cannot delete service because it is linked with existing records", 409);
    }

    await prisma.service.delete({ where: { id } });

    return ok(null, "Service deleted successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Service not found", 404);
        case "P2003":
          return err("Cannot delete service because it is referenced by other records", 409);
      }
    }

    console.error("DELETE Service Error:", error);
    return err("Internal server error", 500);
  }
}
