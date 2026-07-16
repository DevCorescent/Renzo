// ============================================================================
// OWNER  : Gauransh
// MODULE : Audit — shared writer
// PURPOSE: One place to record a mutation in the existing AuditLog model, so every
//          route logs the same way instead of hand-rolling `auditLog.create`.
//
// BACKEND: Writes AuditLog (existing model) only — no new table, no new fields.
// ERROR HANDLING: Auditing is best-effort — a logging failure must NEVER break or
//          roll back the business operation, so every write is swallowed.
// ============================================================================

import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type AuditInput = {
  action: string; // CREATE | UPDATE | DELETE | APPROVE | REJECT | …
  module: string; // MARKETING, COUPON, CAMPAIGN, GIFT_CARD, …
  refId?: string | null;
  refType?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

/**
 * Record an admin action against the actor. Call AFTER the mutation succeeds.
 * `tx` lets it join a surrounding transaction; otherwise it uses the base client.
 */
export async function writeAudit(user: AuthUser, input: AuditInput, tx?: Tx): Promise<void> {
  const db = tx ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        userId: user.userId,
        userType: user.userType,
        action: input.action,
        module: input.module,
        refId: input.refId ?? null,
        refType: input.refType ?? null,
        ...(input.oldValue !== undefined ? { oldValue: input.oldValue } : {}),
        ...(input.newValue !== undefined ? { newValue: input.newValue } : {}),
      },
    });
  } catch {
    // Never let an audit failure surface to the caller or undo the operation.
  }
}
