import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { PageHeader } from "@/components/shared/ui";
import { InvoiceSettingsForm } from "@/components/settings/invoice-settings-form";
import prisma from "@/lib/db";

// MODULE: Branch Admin — Invoice & Branch Settings
// Access: BRANCH_ADMIN (own branch), OWNER

export default async function BranchSettingsPage() {
  const user = await getServerUser();
  if (!user || !["BRANCH_ADMIN", "OWNER"].includes(user.userType)) redirect("/staff/login");
  if (!user.branchId) redirect("/unauthorized");

  // Upsert-on-read: first visit creates defaults, never 404s.
  const settings = await prisma.branchSetting.upsert({
    where: { branchId: user.branchId },
    update: {},
    create: { branchId: user.branchId },
    select: {
      invoiceBusinessName: true,
      invoiceTagline: true,
      invoiceAddress: true,
      invoicePhone: true,
      invoiceEmail: true,
      invoiceWebsite: true,
      invoiceFooterNote: true,
      taxName: true,
      taxNumber: true,
      taxPercent: true,
      invoicePrefix: true,
      printFormat: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title="Invoice Settings"
        subtitle="Configure what every invoice and receipt printed by this branch shows. Set once — applies to all invoices automatically."
      />
      <InvoiceSettingsForm
        branchId={user.branchId}
        initial={{
          invoiceBusinessName: settings.invoiceBusinessName,
          invoiceTagline: settings.invoiceTagline,
          invoiceAddress: settings.invoiceAddress,
          invoicePhone: settings.invoicePhone,
          invoiceEmail: settings.invoiceEmail,
          invoiceWebsite: settings.invoiceWebsite,
          invoiceFooterNote: settings.invoiceFooterNote,
          taxName: settings.taxName,
          taxNumber: settings.taxNumber,
          taxPercent: settings.taxPercent,
          invoicePrefix: settings.invoicePrefix,
          printFormat: settings.printFormat,
        }}
      />
    </div>
  );
}
