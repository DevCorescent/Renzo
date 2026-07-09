import { NextRequest } from "next/server";
import { ok, created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import { creditWallet } from "@/lib/wallet";

// OWNER: Shalmon | MODULE: Customer Membership
// GET /api/v1/customer/membership — Active membership with plan + usage logs
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const membership = await prisma.customerMembership.findFirst({
      where: { customerId: user.customerId, status: "ACTIVE" },
      orderBy: { purchasedAt: "desc" },
      include: {
        plan: { include: { benefits: true } },
        usageLogs: { orderBy: { usedAt: "desc" }, take: 20 },
      },
    });

    if (!membership) return ok(null, "No active membership");

    const daysRemaining = Math.max(
      0,
      Math.ceil((membership.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
    return ok({ ...membership, daysRemaining });
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/customer/membership — Purchase a plan
// Body: { planId, branchId? }
// Creates an UNPAID invoice for the plan price, activates the membership, and
// credits any bundled wallet amount.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);
  const customerId = user.customerId;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const planId: string = typeof body.planId === "string" ? body.planId : "";
    if (!planId) return err("Validation failed", 422, { planId: ["planId is required"] });

    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) return err("Plan not found", 404);
    if (!plan.isActive) return err("Plan is not available", 409);

    // One active membership at a time.
    const active = await prisma.customerMembership.findFirst({
      where: { customerId, status: "ACTIVE" },
    });
    if (active) return err("You already have an active membership", 409);

    // Invoice.branchId is required — take it from the body, or from a
    // branch-restricted plan.
    const branchId =
      typeof body.branchId === "string"
        ? body.branchId
        : plan.branchAccess !== "ALL"
          ? plan.branchAccess
          : "";
    if (!branchId) return err("Validation failed", 422, { branchId: ["branchId is required"] });

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.validityDays * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo: genCode("INV"),
          customerId,
          branchId,
          subtotal: plan.price,
          totalAmount: plan.price,
          balanceDue: plan.price,
          status: "UNPAID",
          generatedBy: user.userId,
          items: {
            create: [
              {
                type: "MEMBERSHIP",
                refId: plan.id,
                name: plan.name,
                quantity: 1,
                unitPrice: plan.price,
                total: plan.price,
              },
            ],
          },
        },
        include: { items: true },
      });

      const membership = await tx.customerMembership.create({
        data: {
          customerId,
          planId: plan.id,
          status: "ACTIVE",
          startDate,
          endDate,
          autoRenew: body.autoRenew === true,
          invoiceId: invoice.id,
        },
        include: { plan: { include: { benefits: true } } },
      });

      if (plan.walletCredit > 0) {
        await creditWallet(tx, customerId, plan.walletCredit, "MEMBERSHIP", {
          refId: membership.id,
          description: `Wallet credit from ${plan.name} membership`,
        });
      }

      return { membership, invoice };
    });

    return created(result, "Membership purchased — invoice pending payment");
  } catch {
    return err("Internal server error", 500);
  }
}
