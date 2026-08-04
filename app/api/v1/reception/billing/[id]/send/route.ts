// ============================================================================
// MODULE : Invoices — delivery
// ROUTE  : /api/v1/reception/billing/:id/send
//
// METHOD
//   POST — Deliver an invoice to the customer.
//          { channel: "EMAIL" | "WHATSAPP", to?, reason? }
//
//   EMAIL    — sends through the EXISTING lib/mailer.ts with the PDF attached.
//   WHATSAPP — returns a wa.me deep link carrying the prefilled message. This
//              project has no WhatsApp Business API credentials; the deep link is
//              the same pattern gift-card sharing already uses. See
//              lib/invoice-delivery.ts for why that is deliberate.
//
// Delivery is recorded in the EXISTING NotificationLog (channel / status / error),
// so "Invoice Sent / Failed / Pending" is answerable without a new table, and in
// the AuditLog against the operator.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER — the same list the
//   billing routes use. Branch-scoped: another branch's invoice answers 404.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { PHONE_RE } from "@/lib/customer-schema";
import {
  invoiceEmailHtml,
  invoiceFilename,
  invoiceMessage,
  loadInvoiceForDelivery,
  renderInvoicePdf,
} from "@/lib/invoice-delivery";
import { resolveWhatsAppProvider, toLogStatus } from "@/lib/messaging/provider";

const MODULE = "INVOICE";

const SendSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  /** Overrides the customer's stored address/number for this send only. */
  to: z.string().trim().max(160).optional(),
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

  const parsed = validate(SendSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const { channel, to } = parsed.data;

  try {
    const { id } = await params;

    const invoice = await loadInvoiceForDelivery(id);
    if (!invoice) return err("Invoice not found", 404);

    // 404 rather than 403 — another branch's invoice must not be discoverable.
    if (!scope.isGlobal && invoice.branchId !== scope.branchId) {
      return err("Invoice not found", 404);
    }

    // ── WhatsApp ──────────────────────────────────────────────────────────
    if (channel === "WHATSAPP") {
      const phone = (to ?? invoice.customerPhone ?? "").trim();
      if (!phone) {
        return err("Validation failed", 422, {
          to: ["This customer has no mobile number — enter one to send the invoice"],
        });
      }
      if (!PHONE_RE.test(phone)) {
        return err("Validation failed", 422, { to: ["Enter a valid mobile number"] });
      }

      const message = invoiceMessage(invoice);

      // Whichever provider is configured. With no WhatsApp Business API wired,
      // this resolves to the deep link, which can only ever report OPENED —
      // never SENT, because nothing on this side observes the operator pressing
      // send. Recording OPENED as "sent" would tell a manager the customer has
      // an invoice they may never have received.
      const provider = resolveWhatsAppProvider();
      const result = await provider.send({ to: phone, body: message, refId: invoice.id });

      await prisma.notificationLog.create({
        data: {
          customerId: invoice.customerId,
          channel: "WHATSAPP",
          trigger: "INVOICE_SENT",
          // The precise state lives in the text because NotificationLog.status
          // has no column for OPENED or QUEUED.
          message: `[${result.state}] ${message}`,
          status: toLogStatus(result.state),
          ...(result.error ? { error: result.error } : {}),
          refId: invoice.id,
        },
      });

      await writeAudit(user, {
        action: "SEND",
        module: MODULE,
        refId: invoice.id,
        refType: "Invoice",
        newValue: {
          channel: "WHATSAPP",
          to: phone,
          invoiceNo: invoice.invoiceNo,
          provider: provider.id,
          deliveryState: result.state,
        },
      });

      if (result.state === "FAILED") {
        return err(result.message, 502);
      }

      return ok(
        {
          channel,
          to: phone,
          state: result.state,
          // Kept as `link` as well as `handoffUrl` so the existing client keeps
          // working while it migrates to the new field.
          link: result.handoffUrl,
          handoffUrl: result.handoffUrl,
          providerTransmits: provider.transmits,
          message,
        },
        result.message
      );
    }

    // ── Email ─────────────────────────────────────────────────────────────
    const address = (to ?? invoice.customerEmail ?? "").trim();
    if (!address) {
      return err("Validation failed", 422, {
        to: ["This customer has no email address — enter one to send the invoice"],
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return err("Validation failed", 422, { to: ["Enter a valid email address"] });
    }

    const pdf = await renderInvoicePdf(invoice);

    try {
      await sendMail({
        to: address,
        subject: `Your Renzo Invoice ${invoice.invoiceNo}`,
        html: invoiceEmailHtml(invoice),
        attachments: [
          {
            filename: invoiceFilename(invoice.invoiceNo),
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (mailError) {
      // A failed send is RECORDED, not swallowed — "Failed" is one of the three
      // delivery states the front desk needs to see.
      await prisma.notificationLog.create({
        data: {
          customerId: invoice.customerId,
          channel: "EMAIL",
          trigger: "INVOICE_SENT",
          message: `Invoice ${invoice.invoiceNo} to ${address}`,
          status: "FAILED",
          error: mailError instanceof Error ? mailError.message.slice(0, 400) : "Unknown error",
          refId: invoice.id,
        },
      });
      return err("Could not send the email — check the address and try again", 502);
    }

    await prisma.notificationLog.create({
      data: {
        customerId: invoice.customerId,
        channel: "EMAIL",
        trigger: "INVOICE_SENT",
        message: `Invoice ${invoice.invoiceNo} to ${address}`,
        status: "SENT",
        refId: invoice.id,
      },
    });

    await writeAudit(user, {
      action: "SEND",
      module: MODULE,
      refId: invoice.id,
      refType: "Invoice",
      newValue: { channel: "EMAIL", to: address, invoiceNo: invoice.invoiceNo },
    });

    return ok({ channel, to: address }, `Invoice emailed to ${address}`);
  } catch {
    return err("Internal server error", 500);
  }
}
