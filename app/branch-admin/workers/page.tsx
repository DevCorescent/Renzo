import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Branch Admin Workers

export default async function BranchAdminWorkersPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const workerBranches = await prisma.workerBranch.findMany({
    where: { branchId },
    orderBy: { joinedAt: "desc" },
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          phone: true,
          experience: true,
          isActive: true,
          designation: { select: { name: true } },
          services: {
            where: { isActive: true },
            include: { service: { select: { name: true } } },
            take: 3,
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Workers</h1>
        <p className="mt-0.5 text-sm text-gray-500">{workerBranches.length} assigned</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Workers</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Designation</TH>
              <TH>Services</TH>
              <TH>Experience</TH>
              <TH>Assignment</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {workerBranches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No workers assigned to this branch.
                </td>
              </tr>
            ) : (
              workerBranches.map((wb) => (
                <TR key={wb.id}>
                  <TD className="font-medium text-gray-900">
                    {wb.worker.firstName} {wb.worker.lastName}
                    {wb.worker.phone && (
                      <p className="text-[11px] font-normal text-gray-400">{wb.worker.phone}</p>
                    )}
                  </TD>
                  <TD className="font-mono text-xs text-gray-400">{wb.worker.employeeCode}</TD>
                  <TD className="text-gray-500">{wb.worker.designation?.name ?? "—"}</TD>
                  <TD className="text-gray-500 text-xs">
                    {wb.worker.services.length > 0
                      ? wb.worker.services.map((s) => s.service.name).join(", ")
                      : "—"}
                  </TD>
                  <TD className="text-gray-500">
                    {wb.worker.experience} yr{wb.worker.experience !== 1 ? "s" : ""}
                  </TD>
                  <TD>
                    <Badge tone={wb.isPrimary ? "primary" : "neutral"}>
                      {wb.isPrimary ? "Primary" : "Secondary"}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={wb.worker.isActive && wb.isActive ? "success" : "danger"}>
                      {wb.worker.isActive && wb.isActive ? "Active" : "Inactive"}
                    </Badge>
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
