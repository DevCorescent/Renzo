import type { Prisma, StockMovementType } from "@prisma/client";

// OWNER: Shalmon | MODULE: Inventory — shared stock ledger
// Every quantity change must go through here so a StockMovement row is always
// written with balanceBefore/balanceAfter. `delta` is signed: +in, -out.

type Db = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  constructor(public available: number) {
    super("INSUFFICIENT_STOCK");
  }
}

export async function getStockQuantity(db: Db, productId: string, branchId: string) {
  const stock = await db.stock.findUnique({
    where: { productId_branchId: { productId, branchId } },
  });
  return stock?.quantity ?? 0;
}

export async function applyStockMovement(
  tx: Db,
  args: {
    productId: string;
    branchId: string;
    delta: number;
    type: StockMovementType;
    performedBy: string;
    refId?: string | null;
    notes?: string | null;
  }
) {
  const { productId, branchId, delta, type, performedBy } = args;

  const balanceBefore = await getStockQuantity(tx, productId, branchId);
  const balanceAfter = balanceBefore + delta;

  // Stock can never go negative — surface it instead of silently clamping.
  if (balanceAfter < 0) throw new InsufficientStockError(balanceBefore);

  await tx.stock.upsert({
    where: { productId_branchId: { productId, branchId } },
    update: { quantity: balanceAfter },
    create: { productId, branchId, quantity: balanceAfter },
  });

  await tx.stockMovement.create({
    data: {
      productId,
      branchId,
      type,
      quantity: Math.abs(delta),
      balanceBefore,
      balanceAfter,
      refId: args.refId ?? null,
      notes: args.notes ?? null,
      performedBy,
    },
  });

  return { balanceBefore, balanceAfter };
}
