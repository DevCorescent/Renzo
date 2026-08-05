// ============================================================================
// MODULE : Invoices — reprint record
// ROUTE  : /api/v1/reception/billing/:id/reprint
//
// METHOD
//   POST — Record that an invoice was reprinted. { reason }
//
// A reprint is not a new document — the PDF comes from the same
// /billing/:id/pdf route as the original, byte for byte. What needs recording is
// WHO reprinted it, WHEN and WHY, because a second copy of a paid bill is exactly
// the artefact a dispute later turns on.
//
// Stored in the EXISTING AuditLog (who / when / reason / branch) rather than a
// new table — requirement 26's "reuse existing AuditLog", and it already answers
// "Reprinted By / Reprinted At / Reason" in full.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";

const MODULE = "INVOICE";

const ReprintSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters").max(300),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  const parsed = validate(ReprintSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, invoiceNo: true, branchId: true },
    });
    if (!invoice) return err("Invoice not found", 404);

    if (!scope.isGlobal && invoice.branchId !== scope.branchId) {
      return err("Invoice not found", 404);
    }

    await writeAudit(user, {
      action: "REPRINT",
      module: MODULE,
      refId: invoice.id,
      refType: "Invoice",
      newValue: {
        invoiceNo: invoice.invoiceNo,
        branchId: invoice.branchId,
        reason: parsed.data.reason,
        reprintedAt: new Date().toISOString(),
      },
    });

    return ok({ id: invoice.id, invoiceNo: invoice.invoiceNo }, "Reprint recorded");
  } catch {
    return err("Internal server error", 500);
  }
}
