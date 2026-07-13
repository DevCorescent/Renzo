import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Appointments
// ROUTE  : /api/v1/customer/appointments/[id]
//
// METHOD
// GET - Customer Appointment Detail
//
// ACCESS
// CUSTOMER
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, "CUSTOMER");

  if (error) return error;

  try {
    const { id } = await params;

    // ------------------------------------------------------------------------
    // Fetch Appointment
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        customerId: user.customerId,
      },

      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },

        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },

        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
          },
        },

        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                image: true,
                description: true,
              },
            },

            variant: {
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },

        addOns: {
          include: {
            addOn: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },

        packages: {
          include: {
            package: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
              },
            },
          },
        },

        _count: {
          select: {
            services: true,
            addOns: true,
            packages: true,
          },
        },
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }
    return ok(
      appointment,
      "Appointment fetched successfully"
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);

        case "P2003":
          return err("Invalid appointment reference", 400);
      }
    }

    console.error(
      "GET Customer Appointment Detail Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}