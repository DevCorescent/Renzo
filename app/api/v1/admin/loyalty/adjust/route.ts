// ============================================================================
// MODULE : Manual Operations — loyalty adjustment
// ROUTE  : /api/v1/admin/loyalty/adjust
//
// METHOD
//   POST — Add or deduct loyalty points by hand.
//          { customerId, points, direction: "ADD" | "DEDUCT", reason }
//
// WHY THIS EXISTS
// ---------------
// Points are otherwise only ever EARNED automatically (lib/loyalty.ts, on
// payment) or REDEEMED by the customer. There was no way to fix a goodwill
// gesture, a migration error or a wrongly-earned balance. This adds that one
// missing door, writing the SAME LoyaltyAccount and LoyaltyTransaction rows the
// automatic path writes — so the customer's ledger stays a single readable
// history rather than splitting into "real" and "manual" streams.
//
// A REASON IS MANDATORY. Hand-editing someone's balance without stating why is
// exactly what the audit trail exists to prevent.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN. Never the front desk.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import { getLoyaltyConfig, getOrCreateLoyaltyAccount, tierFor } from "@/lib/loyalty";
import { operationsCapabilitiesFor } from "@/lib/operations";

const MODULE = "LOYALTY";

const AdjustSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  points: z.number().int().positive("Points must be a positive whole number").max(1_000_000),
  direction: z.enum(["ADD", "DEDUCT"]),
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters").max(300),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canAdjustLoyalty) {
    return err("Forbidden — your role cannot adjust loyalty points", 403);
  }

  const parsed = validate(AdjustSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const { customerId, points, direction, reason } = parsed.data;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, deletedAt: true, branchId: true, firstName: true },
    });
    if (!customer || customer.deletedAt) {
      return err("Validation failed", 422, { customerId: ["Unknown or deleted customer"] });
    }

    // A branch admin may only touch their own branch's customers; unassigned
    // (self-registered) customers belong to the salon and stay reachable.
    if (!scope.isGlobal && customer.branchId !== null && customer.branchId !== scope.branchId) {
      return err("Customer not found", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const config = await getLoyaltyConfig(tx);
      const account = await getOrCreateLoyaltyAccount(tx, customerId);

      const delta = direction === "ADD" ? points : -points;
      const balanceBefore = account.availablePoints;
      const balanceAfter = balanceBefore + delta;

      // A negative balance is not a thing. Report it rather than clamping, so the
      // operator learns the deduction was larger than what was there.
      if (balanceAfter < 0) {
        return { tooMany: true as const, available: balanceBefore };
      }

      // Only an ADD grows lifetime earnings, and therefore the tier. A correction
      // that takes points away must not promote someone.
      const lifetimeEarned =
        direction === "ADD" ? account.lifetimeEarned + points : account.lifetimeEarned;

      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          availablePoints: balanceAfter,
          totalPoints: direction === "ADD" ? account.totalPoints + points : account.totalPoints,
          lifetimeEarned,
          tier: tierFor(lifetimeEarned, config),
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          // The enum already carries ADJUSTED for exactly this case. Logging a
          // hand correction as EARNED would make it indistinguishable from points
          // the customer actually spent money to get.
          type: "ADJUSTED",
          points,
          balanceBefore,
          balanceAfter,
          description: `Manual ${direction === "ADD" ? "credit" : "debit"}: ${reason}`,
        },
      });

      return { tooMany: false as const, account: updated, balanceBefore, balanceAfter };
    });

    if (result.tooMany) {
      return err("Validation failed", 422, {
        points: [`Only ${result.available} point(s) available to deduct`],
      });
    }

    await writeAudit(user, {
      action: "UPDATE",
      module: MODULE,
      refId: customerId,
      refType: "LoyaltyAccount",
      oldValue: { availablePoints: result.balanceBefore },
      newValue: {
        availablePoints: result.balanceAfter,
        direction,
        points,
        reason,
        tier: result.account.tier,
      },
    });

    return ok(
      {
        customerId,
        direction,
        points,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        tier: result.account.tier,
      },
      `${direction === "ADD" ? "Added" : "Deducted"} ${points} point(s)`
    );
  } catch {
    return err("Internal server error", 500);
  }
}
