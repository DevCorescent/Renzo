import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Worker — Profile

export default async function WorkerProfilePage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      designation: { select: { name: true, level: true } },
      department: { select: { name: true } },
      skills: { include: { skill: { select: { name: true } } } },
      services: { where: { isActive: true }, include: { service: { select: { name: true, duration: true } } } },
      branches: { include: { branch: { select: { name: true, city: true } } } },
    },
  });

  if (!worker) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {worker.firstName} {worker.lastName}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {worker.designation?.name ?? "Worker"} · {worker.experience} yrs experience
          </p>
        </div>
        <Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Employee Code", worker.employeeCode],
              ["Department", worker.department?.name ?? "—"],
              ["Designation", worker.designation?.name ?? "—"],
              ["Gender", worker.gender],
              ["Phone", worker.phone ?? "—"],
              ["Email", worker.email ?? "—"],
              ["Date of Birth", worker.dateOfBirth ? new Date(worker.dateOfBirth).toLocaleDateString("en-IN") : "—"],
              ["Join Date", new Date(worker.joinDate).toLocaleDateString("en-IN")],
              ["Languages", worker.languages.join(", ") || "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded border border-gray-100 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                <dd className="mt-1 text-sm text-gray-800">{String(value)}</dd>
              </div>
            ))}
          </dl>
          {worker.bio && (
            <div className="mt-4 rounded border border-gray-100 p-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Bio</dt>
              <dd className="mt-1 text-sm text-gray-700">{worker.bio}</dd>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2 p-4">
            {worker.skills.length > 0
              ? worker.skills.map((sk) => (
                  <Badge key={sk.id} tone="neutral">{sk.skill.name} {sk.proficiency}/5</Badge>
                ))
              : <p className="text-sm text-gray-400">No skills listed.</p>
            }
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Services</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {worker.services.length > 0
              ? worker.services.map((ws) => (
                  <div key={ws.id} className="flex justify-between px-4 py-2.5">
                    <p className="text-sm text-gray-700">{ws.service.name}</p>
                    <p className="text-xs text-gray-400">{ws.service.duration} min</p>
                  </div>
                ))
              : <p className="px-4 py-4 text-sm text-gray-400">No services assigned.</p>
            }
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Branch Assignments</CardTitle></CardHeader>
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
    </div>
  );
}
