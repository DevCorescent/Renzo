// ============================================================================
// OWNER  : Gauransh
// MODULE : Notification log — thin writer
// PURPOSE: One place to record a customer/worker notification in the EXISTING
//          NotificationLog model, so routes don't hand-roll `notificationLog.create`.
//          This is not a new notification system — it reuses NotificationLog.
// ERROR HANDLING: Best-effort — a logging failure must never break the operation.
// ============================================================================

import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type LogInput = {
  customerId?: string | null;
  workerId?: string | null;
  trigger: string; // e.g. GIFT_CARD_PURCHASED, GIFT_CARD_SHARED, GIFT_CARD_REDEEMED
  message: string;
  refId?: string | null; // e.g. the GiftCard id
};

/**
 * Write a NotificationLog entry (channel PUSH, status SENT). `tx` joins a surrounding
 * transaction. Swallows errors so notification logging can never roll back the caller.
 */
export async function logNotification(input: LogInput, tx?: Tx): Promise<void> {
  const db = tx ?? prisma;
  try {
    await db.notificationLog.create({
      data: {
        customerId: input.customerId ?? null,
        workerId: input.workerId ?? null,
        channel: "PUSH",
        trigger: input.trigger,
        message: input.message,
        status: "SENT",
        refId: input.refId ?? null,
      },
    });
  } catch {
    // best-effort — never surface to the caller
  }
}
