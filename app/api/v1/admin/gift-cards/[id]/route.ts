import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import type { GiftCardStatus, Prisma } from "@prisma/client";

const STATUSES: GiftCardStatus[] = ["ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"];

// OWNER: Shalmon | MODULE: Gift Cards
// GET /api/v1/admin/gift-cards/[id] — Detail with redemption history + current owner.
// ACCESS adds MARKETING_MANAGER.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      include: {
        redemptions: { orderBy: { redeemedAt: "desc" } },
        // Current owner name for the detail drawer (owner may differ after transfer).
        owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!giftCard) return err("Gift card not found", 404);

    // TRANSFER HISTORY — derived from the existing AuditLog (ownership changes are
    // logged as UPDATE with an `ownedBy` in newValue). Owner ids are resolved to
    // names so no internal id is exposed to the UI.
    const auditEntries = await prisma.auditLog.findMany({
      where: { refId: id, module: "GIFT_CARD", action: "UPDATE" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, oldValue: true, newValue: true, createdAt: true },
    });
    const hasOwned = (v: unknown): v is { ownedBy?: string } => !!v && typeof v === "object" && "ownedBy" in v;
    const transferEntries = auditEntries.filter((e) => hasOwned(e.newValue) && typeof (e.newValue as { ownedBy?: unknown }).ownedBy === "string");
    const ownerIds = [...new Set(
      transferEntries.flatMap((e) => [
        hasOwned(e.newValue) ? e.newValue.ownedBy : undefined,
        hasOwned(e.oldValue) ? e.oldValue.ownedBy : undefined,
      ].filter((x): x is string => typeof x === "string"))
    )];
    const owners = ownerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: ownerIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const nameOf = new Map(owners.map((c) => [c.id, `${c.firstName} ${c.lastName ?? ""}`.trim()]));
    const transfers = transferEntries.map((e) => {
      const from = hasOwned(e.oldValue) && typeof e.oldValue.ownedBy === "string" ? nameOf.get(e.oldValue.ownedBy) ?? "—" : "—";
      const to = hasOwned(e.newValue) && typeof e.newValue.ownedBy === "string" ? nameOf.get(e.newValue.ownedBy) ?? "—" : "—";
      return { id: e.id, at: e.createdAt, from, to };
    });

    return ok({ ...giftCard, transfers });
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/gift-cards/[id] — Edit safe fields + activate/deactivate (status).
// ACCESS adds MARKETING_MANAGER. Only status + presentation/expiry fields are editable;
// value/balance are never mutated here (they change through redemption, not edits).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    // Status, when provided, must be a real enum member.
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return err("Validation failed", 422, { status: ["Invalid gift card status"] });
    }

    const existing = await prisma.giftCard.findUnique({ where: { id } });
    if (!existing) return err("Gift card not found", 404);

    const data: Prisma.GiftCardUpdateInput = {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(typeof body.recipientName === "string" ? { recipientName: body.recipientName.trim() || null } : {}),
      ...(typeof body.recipientPhone === "string" ? { recipientPhone: body.recipientPhone.trim() || null } : {}),
      ...(typeof body.giftMessage === "string" ? { giftMessage: body.giftMessage.trim() || null } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
    };
    if (Object.keys(data).length === 0) return err("No fields provided to update", 400);

    const giftCard = await prisma.giftCard.update({ where: { id }, data });
    await writeAudit(user, { action: "UPDATE", module: "GIFT_CARD", refId: id, refType: "GiftCard", oldValue: { status: existing.status }, newValue: { status: giftCard.status } });
    return ok(giftCard, "Gift card updated");
  } catch {
    return err("Internal server error", 500);
  }
}
