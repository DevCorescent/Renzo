// ============================================================================
// MODULE : Customers — profile page
//
// The branch-scoped customer profile, shared by Branch Admin and Reception. Reads
// through GET /api/v1/admin/customers/:id rather than Prisma directly, so branch
// scoping is enforced by the same guard the rest of the module uses — a branch
// admin opening another branch's customer gets the API's 404, not a leaked record.
//
// The Super Admin profile at /super-admin/customers/[id] is a separate, older and
// much fuller page (wallet, loyalty ledger, membership history) owned elsewhere in
// the codebase; it is deliberately left untouched.
// ============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { apiGet } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/shared/ui";
import {
  ageFromDob,
  formatCurrency,
  formatDate,
  labelise,
  type CustomerRow,
} from "@/components/customers/types";

type AppointmentSummary = {
  id: string;
  appointmentNo: string;
  appointmentDate: string;
  startTime: string;
  status: string;
  totalAmount: number;
  branch: { name: string } | null;
};

type CustomerDetail = CustomerRow & { appointments: AppointmentSummary[] };

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "warning",
  STARTED: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  RESCHEDULED: "info",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-800 dark:text-(--sa-text)">{value || "—"}</dd>
    </div>
  );
}

export async function CustomerProfile({
  id,
  backPath,
  bookingPath,
}: {
  id: string;
  backPath: string;
  bookingPath: string | null;
}) {
  const result = await apiGet<CustomerDetail>(`${API.admin.customers}/${id}`);

  // The API answers 404 both for "no such customer" and "not yours", which is the
  // point — out-of-scope existence is not disclosed.
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <p className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        {result.message || "Could not load this customer."}
      </p>
    );
  }

  const c = result.data;
  const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
  const age = ageFromDob(c.dateOfBirth);
  const membership = c.memberships[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Customer"
          title={name}
          subtitle={`${c.phone ?? "No phone"}${c.branch ? ` · ${c.branch.name}` : ""}`}
        />
        <div className="flex items-center gap-2">
          <Link
            href={backPath}
            className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> All customers
          </Link>
          {bookingPath && (
            <Link
              href={bookingPath}
              className="inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90"
            >
              <CalendarPlus className="size-3.5" aria-hidden="true" /> Book appointment
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={c.customerType === "VIP" ? "warning" : "info"}>
          {labelise(c.customerType)}
        </Badge>
        <Badge tone={c.isManualEntry ? "warning" : "neutral"}>
          {c.isManualEntry ? "Manual entry" : "Self-registered"}
        </Badge>
        {membership && <Badge tone="success">{membership.plan.name}</Badge>}
        {c.deletedAt && <Badge tone="danger">Deleted</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Mobile" value={c.phone} />
              <Field label="Alternate" value={c.alternatePhone} />
              <Field label="Email" value={c.email} />
              <Field label="Gender" value={c.gender ? labelise(c.gender) : null} />
              <Field label="Date of birth" value={c.dateOfBirth ? formatDate(c.dateOfBirth) : null} />
              <Field label="Age" value={age === null ? null : `${age} years`} />
              <Field label="Address" value={c.address} />
              <Field label="City" value={c.city} />
              <Field label="State" value={c.state} />
              <Field label="Pincode" value={c.pincode} />
              <Field label="Source" value={labelise(c.entrySource)} />
              <Field label="Added" value={formatDate(c.createdAt)} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid gap-4 grid-cols-2">
              <Field label="Visits" value={String(c.totalVisits)} />
              <Field label="Total spend" value={formatCurrency(c.totalSpend)} />
              <Field label="Appointments" value={String(c._count.appointments)} />
              <Field
                label="Membership"
                value={membership ? `${membership.plan.name} · till ${formatDate(membership.endDate)}` : null}
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent appointments</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Number</TH>
              <TH>Date</TH>
              <TH>Time</TH>
              <TH>Branch</TH>
              <TH>Status</TH>
              <TH>Amount</TH>
            </tr>
          </THead>
          <tbody>
            {c.appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                  No appointments yet.
                </td>
              </tr>
            ) : (
              c.appointments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {a.appointmentNo}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatDate(a.appointmentDate)}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {a.startTime}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {a.branch?.name ?? "—"}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{labelise(a.status)}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-xs font-medium text-gray-800 dark:text-(--sa-text)">
                    {formatCurrency(a.totalAmount)}
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
