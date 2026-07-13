import { NextRequest } from "next/server";
import { ok, err, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { getOrCreateWallet } from "@/lib/wallet";

// OWNER: Shalmon | MODULE: Customer Wallet
// GET /api/v1/customer/wallet — Balance + paginated transaction history
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    const wallet = await getOrCreateWallet(prisma, user.customerId);

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return ok({
      balance: wallet.balance,
      totalAdded: wallet.totalAdded,
      totalUsed: wallet.totalUsed,
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return err("Internal server error", 500);
  }
}
