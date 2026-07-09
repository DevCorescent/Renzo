import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Service Categories
// ROUTE  : /api/v1/admin/services/categories/[id]
//
// METHODS
// GET     - Get Service Category Details
// PATCH   - Update Service Category
// DELETE  - Delete Service Category
//
// ACCESS
// GET     : SUPER_ADMIN, OWNER
// PATCH   : SUPER_ADMIN, OWNER
// DELETE  : SUPER_ADMIN, OWNER
// ============================================================================

const VALID_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

type Gender = (typeof VALID_GENDERS)[number];

/**
 * Checks whether the provided value is a valid Gender.
 */
function isValidGender(value: unknown): value is Gender {
  return (
    typeof value === "string" &&
    (VALID_GENDERS as readonly string[]).includes(value)
  );
}

/**
 * Converts a category name into a URL-friendly slug.
 */
function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Returns a trimmed string or undefined.
 */
function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

/* ============================================================================
   GET /api/v1/admin/services/categories/[id]

   Description
   -----------
   Returns a single service category by its ID.

   Access
   ------
   SUPER_ADMIN
   OWNER
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

    // ------------------------------------------------------------
    // Validate Category ID
    // ------------------------------------------------------------

    if (!id.trim()) {
      return err("Category ID is required");
    }

    // ------------------------------------------------------------
    // Fetch Category
    // ------------------------------------------------------------

    const category = await prisma.serviceCategory.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            services: true,
            subCategories: true,
          },
        },
      },
    });

    // ------------------------------------------------------------
    // Category Not Found
    // ------------------------------------------------------------

    if (!category) {
      return err("Service category not found", 404);
    }

    // ------------------------------------------------------------
    // Success Response
    // ------------------------------------------------------------

    return ok(
      category,
      "Service category fetched successfully"
    );
  } catch (error) {
    console.error("GET Service Category Error:", error);

    return err("Internal server error", 500);
  }
}
/* ============================================================================
   PATCH /api/v1/admin/services/categories/[id]

   Description
   -----------
   Updates an existing service category.

   Access
   ------
   SUPER_ADMIN
   OWNER
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

    // ------------------------------------------------------------
    // Validate Category ID
    // ------------------------------------------------------------

    if (!id.trim()) {
      return err("Category ID is required");
    }

    // ------------------------------------------------------------
    // Check Existing Category
    // ------------------------------------------------------------

    const existingCategory = await prisma.serviceCategory.findUnique({
      where: {
        id,
      },
    });

    if (!existingCategory) {
      return err("Service category not found", 404);
    }

    // ------------------------------------------------------------
    // Request Body
    // ------------------------------------------------------------

    const body = await req.json();

    const {
      name,
      description,
      image,
      icon,
      gender,
      sortOrder,
      isActive,
    } = body ?? {};

    // ------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return err("Category name cannot be empty");
    }

    if (
      gender !== undefined &&
      !isValidGender(gender)
    ) {
      return err("Invalid gender");
    }

    // ------------------------------------------------------------
    // Generate New Slug (only if name changes)
    // ------------------------------------------------------------

    let slug = existingCategory.slug;

    if (
      typeof name === "string" &&
      name.trim() &&
      name.trim() !== existingCategory.name
    ) {
      slug = toSlug(name);

      if (!slug) {
        return err(
          "Category name must contain at least one letter or number"
        );
      }

      // Duplicate Name

      const duplicateName = await prisma.serviceCategory.findFirst({
        where: {
          id: {
            not: id,
          },
          name: {
            equals: name.trim(),
            mode: "insensitive",
          },
        },
      });

      if (duplicateName) {
        return err("Category name already exists", 409);
      }

      // Duplicate Slug

      const duplicateSlug = await prisma.serviceCategory.findFirst({
        where: {
          id: {
            not: id,
          },
          slug,
        },
      });

      if (duplicateSlug) {
        return err("Category slug already exists", 409);
      }
    }

    // ------------------------------------------------------------
    // Update Category
    // ------------------------------------------------------------

    const updatedCategory = await prisma.serviceCategory.update({
      where: {
        id,
      },

      data: {
        name:
          typeof name === "string"
            ? name.trim()
            : undefined,

        slug,

        description:
          description !== undefined
            ? optionalTrimmedString(description) ?? null
            : undefined,

        image:
          image !== undefined
            ? optionalTrimmedString(image) ?? null
            : undefined,

        icon:
          icon !== undefined
            ? optionalTrimmedString(icon) ?? null
            : undefined,

        gender:
          gender !== undefined
            ? gender
            : undefined,

        sortOrder:
          sortOrder !== undefined
            ? Number(sortOrder)
            : undefined,

        isActive:
          isActive !== undefined
            ? Boolean(isActive)
            : undefined,
      },
    });

    // ------------------------------------------------------------
    // Success Response
    // ------------------------------------------------------------

    return ok(
      updatedCategory,
      "Service category updated successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return err(
        "Category name or slug already exists",
        409
      );
    }

    console.error("PATCH Service Category Error:", error);

    return err("Internal server error", 500);
  }
}
/* ============================================================================
   DELETE /api/v1/admin/services/categories/[id]

   Description
   -----------
   Deletes an existing service category.

   Safety Checks
   -------------
   • Category must exist
   • Category should not contain any Services
   • Category should not contain any Sub Categories

   Access
   ------
   SUPER_ADMIN
   OWNER
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

    // ------------------------------------------------------------
    // Validate Category ID
    // ------------------------------------------------------------

    if (!id.trim()) {
      return err("Category ID is required");
    }

    // ------------------------------------------------------------
    // Check Category Exists
    // ------------------------------------------------------------

    const category = await prisma.serviceCategory.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            services: true,
            subCategories: true,
          },
        },
      },
    });

    if (!category) {
      return err("Service category not found", 404);
    }

    // ------------------------------------------------------------
    // Prevent Deleting Category
    // If Services Exist
    // ------------------------------------------------------------

    if (category._count.services > 0) {
      return err(
        "Cannot delete category because services are attached to it",
        409
      );
    }

    // ------------------------------------------------------------
    // Prevent Deleting Category
    // If Sub Categories Exist
    // ------------------------------------------------------------

    if (category._count.subCategories > 0) {
      return err(
        "Cannot delete category because sub categories exist",
        409
      );
    }

    // ------------------------------------------------------------
    // Delete Category
    // ------------------------------------------------------------

    await prisma.serviceCategory.delete({
      where: {
        id,
      },
    });

    // ------------------------------------------------------------
    // Success Response
    // ------------------------------------------------------------

    return ok(
      null,
      "Service category deleted successfully"
    );
  } catch (error) {
    console.error(
      "DELETE Service Category Error:",
      error
    );

    return err("Internal server error", 500);
  }
}