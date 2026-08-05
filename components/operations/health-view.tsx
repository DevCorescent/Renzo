// ============================================================================
// MODULE : System health dashboard
//
// What a manager should fix BEFORE staff meet it. Ordered by who gets hurt
// first: a stylist nobody can book blocks a customer standing at the desk, so
// it leads; a stale membership can wait.
//
// Every row links to the screen that fixes it — a health check that only tells
// you something is wrong is a to-do list, not a tool.
// ============================================================================

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Users,
  Boxes,
  Receipt,
  CalendarClock,
  Database,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/shared/ui";
import { formatMoney } from "@/lib/operations";
import type { HealthReport } from "@/lib/health-service";

type Row = {
  label: string;
  value: number;
  /** Non-zero is a problem. */
  bad: boolean;
  hint?: string;
  href?: string;
};

function Section({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Row[];
}) {
  const problems = rows.filter((r) => r.bad).length;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-gray-400 dark:text-(--sa-muted)" aria-hidden="true" />
          {title}
        </CardTitle>
        {problems === 0 ? (
          <Badge tone="success">All clear</Badge>
        ) : (
          <Badge tone="warning">{problems} to fix</Badge>
        )}
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((row) => {
            const body = (
              <span className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm",
                      row.bad
                        ? "text-gray-900 dark:text-(--sa-text)"
                        : "text-gray-500 dark:text-(--sa-text-2)"
                    )}
                  >
                    {row.label}
                  </span>
                  {row.hint && (
                    <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                      {row.hint}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      row.bad
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-400 dark:text-(--sa-muted)"
                    )}
                  >
                    {row.value}
                  </span>
                  {row.bad ? (
                    <AlertTriangle className="size-3.5 text-amber-500" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden="true" />
                  )}
                  {row.href && row.bad && (
                    <ArrowRight
                      className="size-3.5 text-gray-300 dark:text-(--sa-muted)"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </span>
            );

            return (
              <li key={row.label}>
                {row.href && row.bad ? (
                  <Link href={row.href} className="block transition hover:opacity-80">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

export function HealthView({
  report,
  basePath,
}: {
  report: HealthReport;
  /** Role prefix, so "fix it" links land on a page this role may open. */
  basePath: string;
}) {
  const { workers, inventory, billing, operations, data, notifications, config } = report;

  const blockers =
    workers.blocked +
    (config.taxUnset ? 1 : 0) +
    (config.noPaymentRail ? 1 : 0) +
    operations.conflictsToday;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="System health"
        subtitle={`Problems to fix before staff hit them — ${report.branchLabel}.`}
      />

      <div
        className={cn(
          "rounded-lg border px-4 py-3",
          blockers === 0
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
            : "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10"
        )}
      >
        <p
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            blockers === 0
              ? "text-emerald-800 dark:text-emerald-300"
              : "text-amber-900 dark:text-amber-300"
          )}
        >
          {blockers === 0 ? (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Ready to trade — nothing blocking the front desk.
            </>
          ) : (
            <>
              <AlertTriangle className="size-4" aria-hidden="true" />
              {blockers} thing{blockers === 1 ? "" : "s"} will block staff today.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Staff readiness"
          icon={Users}
          rows={[
            {
              label: "Stylists who cannot be booked",
              value: workers.blocked,
              bad: workers.blocked > 0,
              hint: `${workers.bookable} of ${workers.total} are bookable`,
              href: `${basePath}/workers/qualifications`,
            },
            {
              label: "No services assigned",
              value: workers.missingServices,
              bad: workers.missingServices > 0,
              hint: "Naming them on a booking is refused",
              // Straight to the screen that fixes it in one click, not to the
              // worker list where it has to be found first.
              href: `${basePath}/workers/qualifications`,
            },
            {
              label: "Not posted to a branch",
              value: workers.missingBranch,
              bad: workers.missingBranch > 0,
              href: `${basePath}/workers`,
            },
            {
              label: "No shift assigned",
              value: workers.missingShift,
              bad: workers.missingShift > 0,
              hint: "Late minutes and overtime cannot be calculated",
              href: `${basePath}/attendance`,
            },
          ]}
        />

        <Section
          title="Today's operations"
          icon={CalendarClock}
          rows={[
            {
              label: "Double-booked stylists",
              value: operations.conflictsToday,
              bad: operations.conflictsToday > 0,
              hint: "Two overlapping bookings for one person",
              href: `${basePath}/calendar`,
            },
            {
              label: "Bookings with no stylist",
              value: operations.unassignedToday,
              bad: operations.unassignedToday > 0,
              href: `${basePath}/calendar`,
            },
            {
              label: "Manual attendance awaiting approval",
              value: operations.pendingApprovals,
              bad: operations.pendingApprovals > 0,
              href: `${basePath}/attendance?entryType=manual`,
            },
          ]}
        />

        <Section
          title="Money"
          icon={Receipt}
          rows={[
            {
              label: "Unpaid or part-paid invoices",
              value: billing.pendingBills,
              bad: billing.pendingBills > 0,
              hint: `${formatMoney(billing.unpaidTotal)} outstanding`,
              href: `${basePath}/billing`,
            },
            {
              label: "Part payments awaiting the balance",
              value: billing.partiallyPaid,
              bad: billing.partiallyPaid > 0,
              href: `${basePath}/billing`,
            },
          ]}
        />

        <Section
          title="Stock"
          icon={Boxes}
          rows={[
            {
              label: "Out of stock",
              value: inventory.outOfStock,
              bad: inventory.outOfStock > 0,
              hint: "Cannot be sold until restocked",
              href: `${basePath}/inventory`,
            },
            {
              label: "At or below reorder level",
              value: inventory.lowStock,
              bad: inventory.lowStock > 0,
              href: `${basePath}/inventory`,
            },
          ]}
        />

        <Section
          title="Data quality"
          icon={Database}
          rows={[
            {
              label: "Duplicate customer phone numbers",
              value: data.duplicatePhones,
              bad: data.duplicatePhones > 0,
              hint: "Visit history and loyalty are split across the copies",
              href: `${basePath}/customers`,
            },
            {
              label: "Memberships past their end date but still active",
              value: data.expiredMemberships,
              bad: data.expiredMemberships > 0,
            },
            {
              label: "Failed notifications",
              value: notifications.failed,
              bad: notifications.failed > 0,
              hint: "Invoices the customer never received",
            },
          ]}
        />

        <Section
          title="Configuration"
          icon={Settings}
          rows={[
            {
              label: "Tax rate not set",
              value: config.taxUnset ? 1 : 0,
              bad: config.taxUnset,
              hint: "Invoices will be raised with no GST",
              href: `${basePath}/branches`,
            },
            {
              label: "No payment method enabled",
              value: config.noPaymentRail ? 1 : 0,
              bad: config.noPaymentRail,
              hint: "Nothing can be collected",
              href: `${basePath}/branches`,
            },
            {
              label: "Branches with no settings row",
              value: config.branchesMissingSettings,
              bad: config.branchesMissingSettings > 0,
              href: `${basePath}/branches`,
            },
          ]}
        />
      </div>

      {report.blockedWorkers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stylists reception cannot book</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {report.blockedWorkers.map((r) => (
                <li key={r.worker.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-40 flex-1">
                    <span className="block text-sm text-gray-900 dark:text-(--sa-text)">
                      {r.worker.name}
                    </span>
                    <span className="block font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">
                      {r.worker.employeeCode}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {r.issues.map((issue) => (
                      <span key={issue.key} title={issue.detail}>
                        <Badge tone={issue.severity === "BLOCKER" ? "danger" : "warning"}>
                          {issue.label}
                        </Badge>
                      </span>
                    ))}
                  </span>
                  <Link
                    href={`${basePath}/workers/${r.worker.id}`}
                    className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
                  >
                    Fix now <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
