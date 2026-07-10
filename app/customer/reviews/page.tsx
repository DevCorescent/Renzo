import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer — Reviews

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "danger", FLAGGED: "neutral",
};

export default async function CustomerReviewsPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const reviews = await prisma.review.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      branch: { select: { name: true } },
      worker: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Reviews</h1>
        <p className="mt-0.5 text-sm text-gray-500">{reviews.length} submitted</p>
      </div>

      {reviews.length === 0 ? (
        <Card><p className="px-4 py-8 text-center text-sm text-gray-400">No reviews yet. Reviews can be submitted after each appointment.</p></Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{r.branch.name}</span>
                  {r.worker && (
                    <span className="text-xs text-gray-400">with {r.worker.firstName} {r.worker.lastName}</span>
                  )}
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                </div>
                <span className="font-mono text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
              </CardHeader>
              <div className="px-4 py-3">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-[11px] text-gray-400">Overall</span>
                    <p className="text-gray-700">{"★".repeat(r.overallRating)}{"☆".repeat(5 - r.overallRating)}</p>
                  </div>
                  {r.serviceRating && (
                    <div>
                      <span className="text-[11px] text-gray-400">Service</span>
                      <p className="text-gray-600">{"★".repeat(r.serviceRating)}{"☆".repeat(5 - r.serviceRating)}</p>
                    </div>
                  )}
                  {r.workerRating && (
                    <div>
                      <span className="text-[11px] text-gray-400">Worker</span>
                      <p className="text-gray-600">{"★".repeat(r.workerRating)}{"☆".repeat(5 - r.workerRating)}</p>
                    </div>
                  )}
                </div>
                {r.comment && <p className="mt-2 text-sm text-gray-600">{r.comment}</p>}
                {r.adminReply && (
                  <div className="mt-3 rounded border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">Response from {r.branch.name}</p>
                    <p className="mt-1 text-xs text-gray-600">{r.adminReply}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
