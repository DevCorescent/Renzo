import Link from "next/link";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Branches Management

export default async function SuperAdminBranchesPage() {
  const branches = await prisma.branch.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          workerBranches: { where: { isActive: true } },
          staffProfiles: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Branches</h1>
          <p className="mt-0.5 text-sm text-gray-500">{branches.length} total</p>
        </div>
        <Link
          href="/super-admin/branches/new"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + New branch
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>City</TH>
              <TH>Phone</TH>
              <TH>Workers</TH>
              <TH>Staff</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No branches yet.
                </td>
              </tr>
            ) : (
              branches.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium text-gray-900">{b.name}</TD>
                  <TD className="font-mono text-xs text-gray-400">{b.code}</TD>
                  <TD className="text-gray-500">{b.city}</TD>
                  <TD className="text-gray-500">{b.phone}</TD>
                  <TD className="text-gray-700">{b._count.workerBranches}</TD>
                  <TD className="text-gray-700">{b._count.staffProfiles}</TD>
                  <TD>
                    <Badge tone={b.isActive ? "success" : "neutral"}>
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/super-admin/branches/${b.id}`}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
                    >
                      Manage
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
