import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Wallet — shared ledger helpers
// Every balance change must go through here so a WalletTransaction row is
// always written alongside it (balanceBefore/After stay auditable).

type Db = Prisma.TransactionClient;

export async function getOrCreateWallet(db: Db, customerId: string) {
  const existing = await db.wallet.findUnique({ where: { customerId } });
  return existing ?? db.wallet.create({ data: { customerId } });
}

export async function creditWallet(
  tx: Db,
  customerId: string,
  amount: number,
  source: string,
  opts: { refId?: string; description?: string } = {}
) {
  const wallet = await getOrCreateWallet(tx, customerId);
  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + amount;

  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: balanceAfter, totalAdded: wallet.totalAdded + amount },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "CREDIT",
      amount,
      balanceBefore,
      balanceAfter,
      source,
      refId: opts.refId ?? null,
      description: opts.description ?? null,
    },
  });

  return updated;
}

export async function debitWallet(
  tx: Db,
  customerId: string,
  amount: number,
  source: string,
  opts: { refId?: string; description?: string } = {}
) {
  const wallet = await getOrCreateWallet(tx, customerId);
  if (wallet.balance < amount) throw new Error("INSUFFICIENT_WALLET_BALANCE");

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore - amount;

  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: balanceAfter, totalUsed: wallet.totalUsed + amount },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "DEBIT",
      amount,
      balanceBefore,
      balanceAfter,
      source,
      refId: opts.refId ?? null,
      description: opts.description ?? null,
    },
  });

  return updated;
}
