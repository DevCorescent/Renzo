import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import { z } from "zod";

const UpdateSchema = z.object({
  firstName:   z.string().min(1).max(50).optional(),
  lastName:    z.string().max(50).optional().nullable(),
  gender:      z.enum(["MALE", "FEMALE", "UNISEX"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  anniversary: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("No customer record", 404);

  const customer = await prisma.customer.findUnique({
    where: { id: user.customerId },
    select: {
      firstName: true, lastName: true, gender: true,
      dateOfBirth: true, anniversary: true, profilePhoto: true,
      referralCode: true, totalVisits: true, totalSpend: true,
      user: { select: { email: true, phone: true, createdAt: true } },
    },
  });
  if (!customer) return err("Not found", 404);
  return ok(customer);
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("No customer record", 404);

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return err("Validation failed", 422, parsed.error.flatten().fieldErrors);

  const { firstName, lastName, gender, dateOfBirth, anniversary } = parsed.data;

  const updated = await prisma.customer.update({
    where: { id: user.customerId },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(gender !== undefined ? { gender } : {}),
      ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
      ...(anniversary !== undefined ? { anniversary: anniversary ? new Date(anniversary) : null } : {}),
    },
    select: { firstName: true, lastName: true, gender: true, dateOfBirth: true, anniversary: true },
  });

  return ok(updated);
}
