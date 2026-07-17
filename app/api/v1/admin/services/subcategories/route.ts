import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Services
// ROUTE  : /api/v1/admin/services/subcategories
//
// METHOD
//   GET — List service sub-categories (optionally scoped to one category), for the
//         Service form's Subcategory dropdown.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN — read-only, same set as the service /
//   category list routes.
//
// WHY THIS ROUTE EXISTS
//   subCategoryId is a real Service field, but no admin endpoint listed the
//   ServiceSubCategory catalog (category detail returns only a _count), so the form
//   had no way to populate the dropdown. This is the one missing READ; it adds no
//   business logic and duplicates nothing. ServiceSubCategory is global (no
//   branchId), so there is no branch scope to apply.
// ============================================================================

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId")?.trim();
    const search = url.searchParams.get("search")?.trim();

    const where: Prisma.ServiceSubCategoryWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    // Sub-categories per category are few; return the ordered list directly (the
    // dropdown needs the whole set, not a page).
    const subCategories = await prisma.serviceSubCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, slug: true, categoryId: true, isActive: true },
    });

    return ok(subCategories, "Sub-categories fetched successfully");
  } catch (error) {
    console.error("GET Service Sub-Categories Error:", error);
    return err("Internal server error", 500);
  }
}
