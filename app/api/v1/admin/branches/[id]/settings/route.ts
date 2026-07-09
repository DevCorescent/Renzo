import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Settings
// GET /api/v1/admin/branches/[id]/settings — Get branch settings
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    // Guard against creating settings for a non-existent branch.
    const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!branch) return err("Branch not found", 404);

    // Upsert-on-read: every branch always resolves to a settings row (defaults
    // come from the schema when the row is first created).
    const settings = await prisma.branchSetting.upsert({
      where: { branchId: id },
      update: {},
      create: { branchId: id },
    });

    return ok(settings);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/branches/[id]/settings — Update branch settings
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    // Whitelist editable settings — never spread raw body into the DB.
    const allowed = [
      "currency",
      "currencySymbol",
      "taxPercent",
      "taxName",
      "taxNumber",
      "advanceBookingDays",
      "minAdvanceBookingHours",
      "maxBookingsPerSlot",
      "cancellationHours",
      "cancellationChargeType",
      "cancellationCharge",
      "rescheduleHours",
      "autoConfirmBookings",
      "requireDepositPercent",
      "loyaltyEnabled",
      "membershipEnabled",
      "onlinePaymentEnabled",
      "offlinePaymentEnabled",
      "invoicePrefix",
      "receiptPrefix",
    ];
    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );
    if (Object.keys(patch).length === 0) {
      return err("No valid settings to update", 422);
    }

    const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!branch) return err("Branch not found", 404);

    // Upsert so PATCH works even if a settings row was never created yet.
    const settings = await prisma.branchSetting.upsert({
      where: { branchId: id },
      update: patch,
      create: { branchId: id, ...patch },
    });

    return ok(settings, "Settings updated");
  } catch {
    return err("Internal server error", 500);
  }
}
