import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Worker — Portfolio

export default async function WorkerPortfolioPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  const items = await prisma.workerPortfolio.findMany({
    where: { workerId },
    orderBy: [{ isApproved: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const approved = items.filter((i) => i.isApproved).length;
  const pending = items.filter((i) => !i.isApproved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Portfolio</h1>
        <p className="mt-0.5 text-sm text-gray-500">{items.length} items · {approved} approved · {pending} pending</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Portfolio Items</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Title</TH>
              <TH>Category</TH>
              <TH>Description</TH>
              <TH>Added</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No portfolio items yet.</td></tr>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD className="font-medium text-gray-900">{item.title ?? "Untitled"}</TD>
                  <TD><Badge tone="neutral">{item.category}</Badge></TD>
                  <TD className="max-w-[200px] truncate text-xs text-gray-500">{item.description ?? "—"}</TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString("en-IN")}</TD>
                  <TD>
                    <Badge tone={item.isApproved ? "success" : "warning"}>
                      {item.isApproved ? "Approved" : "Pending"}
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
