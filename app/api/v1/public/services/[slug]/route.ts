import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Public Services
// ROUTE  : /api/v1/public/services/[slug]
//
// METHOD
// GET - Get Public Service Detail
//
// ACCESS
// Public (No Authentication)
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const service = await prisma.service.findFirst({
      where: {
        slug,
        isActive: true,
        category: {
          isActive: true,
        },
      },

      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        basePrice: true,
        duration: true,
        bufferTime: true,
        taxPercent: true,
        gender: true,
        isPopular: true,
        sortOrder: true,

        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        subCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        variants: {
          where: {
            isActive: true,
          },

          orderBy: {
            price: "asc",
          },

          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
        },

        serviceAddOns: {
          include: {
            addOn: {
              select: {
                id: true,
                name: true,
                description: true,
                image: true,
                price: true,
                duration: true,
              },
            },
          },
        },

        _count: {
          select: {
            variants: true,
            serviceAddOns: true,
          },
        },
      },
    });

    if (!service) {
      return err("Service not found", 404);
    }

    return ok(
      service,
      "Service fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Public Service Detail Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}