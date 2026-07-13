import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  FLAGGED: "neutral",
};

export default async function MarketingReviewsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      branch: { select: { name: true } },
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
          {reviews.length} reviews · {pending} pending · {avgRating} avg rating
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Reviews", value: reviews.length },
          { label: "Pending", value: pending },
          { label: "Approved", value: reviews.filter((r) => r.status === "APPROVED").length },
          { label: "Avg Rating", value: `${avgRating} ★` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Reviews</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Branch</TH>
              <TH>Worker</TH>
              <TH>Overall</TH>
              <TH>Service</TH>
              <TH>Worker Rating</TH>
              <TH>Comment</TH>
              <TH>Date</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No reviews yet.</td></tr>
            ) : reviews.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-gray-900">{r.branch.name}</TD>
                <TD className="text-gray-500">
                  {r.worker ? `${r.worker.firstName} ${r.worker.lastName}` : "—"}
                </TD>
                <TD>
                  <span className="font-mono text-sm text-amber-600">{"★".repeat(r.overallRating)}</span>
                  <span className="font-mono text-sm text-gray-200">{"★".repeat(5 - r.overallRating)}</span>
                </TD>
                <TD className="text-gray-700">{r.serviceRating ?? "—"}</TD>
                <TD className="text-gray-700">{r.workerRating ?? "—"}</TD>
                <TD className="max-w-xs text-xs text-gray-500">
                  {r.comment ? r.comment.slice(0, 60) + (r.comment.length > 60 ? "…" : "") : "—"}
                </TD>
                <TD className="text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString("en-IN")}
                </TD>
                <TD><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
