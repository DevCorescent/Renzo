import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Branch Admin — Reviews

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "danger", FLAGGED: "neutral",
};

export default async function BranchAdminReviewsPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const reviews = await prisma.review.findMany({
    where: { branchId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      worker: { select: { firstName: true, lastName: true } },
    },
  });

  const pending = reviews.filter((r) => r.status === "PENDING").length;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {reviews.length} total · {pending} pending · avg {avgRating} ★
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Reviews</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Customer</TH>
              <TH>Worker</TH>
              <TH>Rating</TH>
              <TH>Comment</TH>
              <TH>Date</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No reviews yet.</td></tr>
            ) : (
              reviews.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-gray-900">{r.customer.firstName} {r.customer.lastName}</TD>
                  <TD className="text-gray-500">
                    {r.worker ? `${r.worker.firstName} ${r.worker.lastName}` : "—"}
                  </TD>
                  <TD className="text-gray-700 text-sm">
                    {"★".repeat(r.overallRating)}{"☆".repeat(5 - r.overallRating)}
                  </TD>
                  <TD className="max-w-[200px] truncate text-xs text-gray-500">{r.comment ?? "—"}</TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString("en-IN")}</TD>
                  <TD><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
