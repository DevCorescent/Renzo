import prisma from "@/lib/db";
import Link from "next/link";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: All Workers

export default async function SuperAdminWorkersPage() {
  const workers = await prisma.workerProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      branches: {
        where: { isPrimary: true },
        include: { branch: { select: { name: true } } },
      },
      designation: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workers</h1>
          <p className="mt-0.5 text-sm text-gray-500">{workers.length} total</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Workers</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Primary Branch</TH>
              <TH>Designation</TH>
              <TH>Experience</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {workers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No workers yet.
                </td>
              </tr>
            ) : (
              workers.map((w) => (
                <TR key={w.id}>
                  <TD className="font-medium text-gray-900">
                    {w.firstName} {w.lastName}
                  </TD>
                  <TD className="font-mono text-xs text-gray-400">{w.employeeCode}</TD>
                  <TD className="text-gray-500">
                    {w.branches[0]?.branch.name ?? "—"}
                  </TD>
                  <TD className="text-gray-500">{w.designation?.name ?? "—"}</TD>
                  <TD className="text-gray-500">{w.experience} yr{w.experience !== 1 ? "s" : ""}</TD>
                  <TD>
                    <Badge tone={w.isActive ? "success" : "neutral"}>
                      {w.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/super-admin/workers/${w.id}`}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
                    >
                      View
                    </Link>
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
