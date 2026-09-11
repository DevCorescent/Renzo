// ============================================================================
// MODULE : Manual Operations — the surface pages
//
// Server components for the four operations that had no home: direct sale,
// expenses, membership sale and loyalty adjustment. Each resolves the caller's
// role, checks the SAME capability the API enforces, loads what the form needs,
// and renders the client component.
//
// Everything else the hub links to (billing, queue, calendar, customers,
// attendance, workers, inventory) is an existing page and is not re-implemented.
// ============================================================================

import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { branchWhere, requireBranchScope } from "@/lib/branch-scope";
import { PageHeader } from "@/components/shared/ui";
import { SaleTerminal, type CatalogueItem } from "@/components/operations/sale-terminal";
import { WalkInConsole } from "@/components/operations/walk-in-console";
import { HealthView } from "@/components/operations/health-view";
import { QualificationManager } from "@/components/operations/qualification-manager";
import { ExpenseManager, type ExpenseRow } from "@/components/operations/expense-manager";
import { MembershipSale, LoyaltyAdjust, type PlanOption } from "@/components/operations/quick-forms";
import { operationsCapabilitiesFor, type OperationsCapability } from "@/lib/operations";
import { billingCapabilitiesFor, BILLABLE_STATUSES } from "@/lib/billing-service";
import { loadHealthReport, loadWorkerReadiness } from "@/lib/health-service";
import { BillingWorkspace } from "@/components/operations/billing-workspace";
import type { AuthUser, UserType } from "@/types/api";

/** Shared guard: role allowed, capability held, branch scope resolved. */
async function guard(
  allowedRoles: readonly UserType[],
  capability: keyof OperationsCapability
): Promise<{ user: AuthUser; caps: OperationsCapability; branchId: string | null; isGlobal: boolean }> {
  const authUser = await getServerUser();
  if (!authUser || !allowedRoles.includes(authUser.userType)) redirect("/login");

  const caps = operationsCapabilitiesFor(authUser.userType);
  if (!caps[capability]) redirect("/unauthorized");

  const { scope, error } = requireBranchScope(authUser);
  if (error || !scope) redirect("/unauthorized");

  return { user: authUser, caps, branchId: scope.branchId, isGlobal: scope.isGlobal };
}

// ============================================================================
// DIRECT SALE
// ============================================================================

export async function SalePage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  // NOT `guard(..., "canManualBill")`: that reads the STATIC table, which cannot
  // know about `BranchSetting.allowReceptionBlankBill`. The real permission comes
  // from billing-service — the same function the API enforces with — so the page
  // and the submit can never disagree.
  const { user, branchId, isGlobal } = await guard(allowedRoles, "canAccess");

  const setting = branchId
    ? await prisma.branchSetting.findUnique({
        where: { branchId },
        select: { taxPercent: true, taxName: true, allowReceptionBlankBill: true },
      })
    : null;

  if (!billingCapabilitiesFor(user.userType, setting?.allowReceptionBlankBill ?? false).canBlankBill) {
    redirect("/unauthorized");
  }

  // A platform role has no branch of their own, so they must say which branch the
  // bill belongs to — the API refuses without one, which is why this list exists.
  const branches = isGlobal
    ? await prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  // Stock is per-branch, so the terminal only offers what this branch can sell.
  // A platform role with no branch selected sees the catalogue without counts.
  const [products, services] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 300,
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        stocks: branchId
          ? { where: { branchId }, select: { quantity: true }, take: 1 }
          : false,
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true, basePrice: true },
    }),
  ]);

  const catalogue: CatalogueItem[] = [
    ...products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.sellingPrice,
      kind: "PRODUCT" as const,
      ...(branchId ? { stock: p.stocks?.[0]?.quantity ?? 0 } : {}),
    })),
    ...services.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.basePrice,
      kind: "SERVICE" as const,
    })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Manual bill"
        subtitle="Bill products, services or a custom charge with no appointment. Stock, tax, loyalty and the invoice all follow the normal rules."
      />
      <SaleTerminal
        catalogue={catalogue}
        taxPercent={setting?.taxPercent ?? 0}
        taxName={setting?.taxName ?? "Tax"}
        branches={branches}
        canChooseBranch={isGlobal}
      />
    </div>
  );
}

// ============================================================================
// WALK-IN CONSOLE
// ============================================================================

export async function WalkInPage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  const { branchId } = await guard(allowedRoles, "canBookAppointment");

  const [setting, services, workers] = await Promise.all([
    branchId
      ? prisma.branchSetting.findUnique({
          where: { branchId },
          select: { taxPercent: true, taxName: true, printFormat: true },
        })
      : Promise.resolve(null),
    // Priced at the BRANCH rate where one exists, exactly as the booking engine
    // prices it — otherwise the preview and the invoice would disagree.
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true,
        name: true,
        basePrice: true,
        duration: true,
        branchPricings: branchId
          ? { where: { branchId, isActive: true }, select: { price: true }, take: 1 }
          : false,
      },
    }),
    // Only stylists actually posted to this branch can take the booking.
    prisma.workerProfile.findMany({
      where: {
        isActive: true,
        ...(branchId ? { branches: { some: { branchId, isActive: true } } } : {}),
      },
      orderBy: { firstName: "asc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true, displayName: true, employeeCode: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Walk-in"
        subtitle="Customer to paid invoice on one screen — no account, no page hopping."
      />
      <WalkInConsole
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.branchPricings?.[0]?.price ?? s.basePrice,
          duration: s.duration,
        }))}
        workers={workers.map((w) => ({
          id: w.id,
          name: w.displayName?.trim() || `${w.firstName} ${w.lastName ?? ""}`.trim(),
          employeeCode: w.employeeCode,
        }))}
        taxPercent={setting?.taxPercent ?? 0}
        taxName={setting?.taxName ?? "Tax"}
        defaultPrintFormat={(setting?.printFormat ?? "A4") as "A4" | "THERMAL_80" | "THERMAL_58"}
        billingBasePath="/reception/billing"
      />
    </div>
  );
}

// ============================================================================
// EXPENSES
// ============================================================================

export async function ExpensesPage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  const { branchId, isGlobal } = await guard(allowedRoles, "canRecordExpense");

  const scopeWhere = branchWhere({
    isGlobal,
    branchId,
  } as Parameters<typeof branchWhere>[0]);

  const [rows, total, sum, branches] = await Promise.all([
    prisma.expense.findMany({
      where: scopeWhere,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        category: true,
        customCategory: true,
        amount: true,
        expenseDate: true,
        description: true,
        paidVia: true,
        vendor: true,
        referenceNo: true,
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.count({ where: scopeWhere }),
    prisma.expense.aggregate({ where: scopeWhere, _sum: { amount: true } }),
    isGlobal
      ? prisma.branch.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const serialised: ExpenseRow[] = rows.map((r) => ({
    ...r,
    expenseDate: r.expenseDate.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Branch expenses"
        subtitle="Rent, electricity, pantry, maintenance and everything else the branch pays for."
      />
      <ExpenseManager
        rows={serialised}
        total={total}
        filteredTotal={sum._sum.amount ?? 0}
        branches={branches}
        canChooseBranch={isGlobal}
      />
    </div>
  );
}

// ============================================================================
// MEMBERSHIP SALE
// ============================================================================

export async function MembershipSalePage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  await guard(allowedRoles, "canSellMembership");

  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    select: {
      id: true,
      name: true,
      tier: true,
      price: true,
      validityDays: true,
      walletCredit: true,
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Sell a membership"
        subtitle="Sell at the counter and activate immediately — benefits apply from the moment it saves."
      />
      {plans.length === 0 ? (
        <p className="rounded border border-gray-200 px-3 py-6 text-center text-sm text-gray-500 dark:border-(--sa-border) dark:text-(--sa-text-2)">
          No active membership plans. Create one under Memberships first.
        </p>
      ) : (
        <MembershipSale plans={plans as PlanOption[]} />
      )}
    </div>
  );
}

// ============================================================================
// LOYALTY ADJUSTMENT
// ============================================================================

export async function LoyaltyPage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  await guard(allowedRoles, "canAdjustLoyalty");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Loyalty adjustment"
        subtitle="Add or deduct points by hand. Every adjustment states a reason and is audited."
      />
      <LoyaltyAdjust />
    </div>
  );
}

// ============================================================================
// SYSTEM HEALTH
// ============================================================================

export async function HealthPage({
  allowedRoles,
  basePath,
}: {
  allowedRoles: readonly UserType[];
  basePath: string;
}) {
  // Health is a management view: it names staff who cannot work and money that
  // is outstanding, so it rides the staff-management capability rather than
  // plain hub access.
  const { branchId, isGlobal } = await guard(allowedRoles, "canManageStaff");

  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } })
    : null;

  const report = await loadHealthReport(
    { isGlobal, branchId } as Parameters<typeof loadHealthReport>[0],
    branch?.name ?? "all branches"
  );

  return <HealthView report={report} basePath={basePath} />;
}

// ============================================================================
// WORKER QUALIFICATIONS
//
// The fix screen for the single most common cause of a failed walk-in: a stylist
// qualified for no services. Health names the count; this page clears it.
// ============================================================================

export async function QualificationPage({ allowedRoles }: { allowedRoles: readonly UserType[] }) {
  const { branchId, isGlobal } = await guard(allowedRoles, "canManageStaff");

  const [rows, services] = await Promise.all([
    loadWorkerReadiness({ isGlobal, branchId } as Parameters<typeof loadWorkerReadiness>[0]),
    // Only what PUT /admin/workers/:id/services will accept — it refuses an
    // inactive service, or one under a deactivated category, so offering either
    // here would produce a 422 the operator could do nothing about.
    prisma.service.findMany({
      where: { isActive: true, category: { isActive: true } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Staff"
        title="Worker qualifications"
        subtitle="Who can be booked, what is missing, and one click to fix it. Reception should never discover this at the counter."
      />
      <QualificationManager rows={rows} services={services} />
    </div>
  );
}

// ============================================================================
// MANUAL BILLING — appointment invoices (the hub "Manual Billing" card)
// ============================================================================

export async function BillingPage({
  allowedRoles,
  basePath,
}: {
  allowedRoles: readonly UserType[];
  /** e.g. "/super-admin/billing" — invoice links stay inside this role's shell. */
  basePath: string;
}) {
  const { branchId, isGlobal } = await guard(allowedRoles, "canBill");

  const [invoices, unbilled, catalogueServices, catalogueProducts] = await Promise.all([
    prisma.invoice.findMany({
      where: branchId ? { branchId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        appointment: {
          select: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        // The customer has arrived (checked in / in-chair / done) but has no
        // invoice yet — anything the billing API will actually accept. Only
        // showing COMPLETED hid arrived customers the desk still had to bill.
        status: { in: [...BILLABLE_STATUSES] },
        invoice: { is: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    // Catalogue for adding ad-hoc services onto a bill at the desk.
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 400,
      select: { id: true, name: true, basePrice: true },
    }),
    // Retail products too — stock is per-branch, so only offer counts for a
    // branch-scoped desk. A platform role with no branch sees them without stock.
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 400,
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        stocks: branchId ? { where: { branchId }, select: { quantity: true }, take: 1 } : false,
      },
    }),
  ]);

  // Invoice has customerId / branchId columns but no Prisma relations — look
  // those up only for rows that need them (counter sales, global branch label).
  const orphanCustomerIds = [
    ...new Set(invoices.filter((i) => !i.appointment).map((i) => i.customerId)),
  ];
  const branchIds = isGlobal ? [...new Set(invoices.map((i) => i.branchId))] : [];
  const [customers, branches] = await Promise.all([
    orphanCustomerIds.length
      ? prisma.customer.findMany({
          where: { id: { in: orphanCustomerIds } },
          select: { id: true, firstName: true, lastName: true, phone: true },
        })
      : Promise.resolve([]),
    branchIds.length
      ? prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const branchById = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <BillingWorkspace
      basePath={basePath}
      showBranch={isGlobal}
      catalogue={[
        ...catalogueServices.map((s) => ({
          id: s.id,
          name: s.name,
          price: Number(s.basePrice),
          kind: "SERVICE" as const,
        })),
        ...catalogueProducts.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.sellingPrice),
          kind: "PRODUCT" as const,
          stock: p.stocks?.[0]?.quantity ?? null,
        })),
      ]}
      invoices={invoices.map((inv) => {
        const c = inv.appointment?.customer ?? customerById.get(inv.customerId);
        return {
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          createdAt: inv.createdAt.toISOString(),
          totalAmount: Number(inv.totalAmount),
          paidAmount: Number(inv.paidAmount),
          balanceDue: Number(inv.balanceDue),
          status: inv.status,
          customerName: c ? `${c.firstName} ${c.lastName ?? ""}`.trim() : "",
          customerPhone: c?.phone ?? null,
          branchName: branchById.get(inv.branchId) ?? null,
        };
      })}
      unbilled={unbilled.map((a) => ({
        id: a.id,
        appointmentNo: a.appointmentNo,
        customerName: `${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim(),
        customerPhone: a.customer.phone,
        services: a.services.map((s) => s.service.name).join(", "),
        totalAmount: Number(a.totalAmount),
      }))}
    />
  );
}
