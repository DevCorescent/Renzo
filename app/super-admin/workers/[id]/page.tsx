import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Worker Detail

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning",
  STARTED: "primary", COMPLETED: "success", CANCELLED: "danger",
  NO_SHOW: "danger", RESCHEDULED: "info",
};

export default async function SuperAdminWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");
  const { id } = await params;

  const worker = await prisma.workerProfile.findUnique({
    where: { id },
    include: {
      designation: { select: { name: true } },
      department: { select: { name: true } },
      branches: { include: { branch: { select: { name: true, city: true } } } },
      services: { where: { isActive: true }, include: { service: { select: { name: true } } } },
      skills: { include: { skill: { select: { name: true } } } },
      appointments: {
        orderBy: { appointmentDate: "desc" },
        take: 20,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          branch: { select: { name: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      },
    },
  });

  if (!worker) notFound();

  const completedAppts = worker.appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{worker.firstName} {worker.lastName}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {worker.designation?.name ?? "Worker"} · {worker.department?.name ?? "—"} · {worker.experience} yrs experience
          </p>
        </div>
        <Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Employee Code</p>
          <p className="mt-1 font-mono text-lg font-semibold text-gray-900">{worker.employeeCode}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Appointments</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{worker.appointments.length}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-green-700">{completedAppts}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Branches</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{worker.branches.length}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Branches</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {worker.branches.map((wb) => (
              <div key={wb.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{wb.branch.name}</p>
                  <p className="text-xs text-gray-400">{wb.branch.city}</p>
                </div>
                <div className="flex gap-2">
                  {wb.isPrimary && <Badge tone="primary">Primary</Badge>}
                  <Badge tone={wb.isActive ? "success" : "neutral"}>{wb.isActive ? "Active" : "Off"}</Badge>
                </div>
              </div>
            ))}
            {worker.branches.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">No branches assigned.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Services ({worker.services.length})</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {worker.services.map((ws) => (
              <div key={ws.id} className="px-4 py-2.5">
                <p className="text-sm text-gray-700">{ws.service.name}</p>
              </div>
            ))}
            {worker.services.length === 0 && <p className="px-4 py-4 text-sm text-gray-400">No services assigned.</p>}
          </div>
        </Card>
      </div>

      {worker.skills.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2 p-4">
            {worker.skills.map((sk) => (
              <Badge key={sk.id} tone="neutral">{sk.skill.name} ({sk.proficiency}/5)</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Appointments</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Date</TH><TH>Customer</TH><TH>Service</TH><TH>Branch</TH><TH>Status</TH></tr></THead>
          <tbody>
            {worker.appointments.map((a) => (
              <TR key={a.id}>
                <TD className="font-mono text-xs text-gray-500">{new Date(a.appointmentDate).toLocaleDateString("en-IN")}</TD>
                <TD className="font-medium text-gray-900">{a.customer.firstName} {a.customer.lastName}</TD>
                <TD className="text-gray-600 text-xs">{a.services.map((s) => s.service.name).join(", ") || "—"}</TD>
                <TD className="text-gray-500">{a.branch.name}</TD>
                <TD><Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge></TD>
              </TR>
            ))}
            {worker.appointments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No appointments yet.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
