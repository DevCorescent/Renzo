import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";

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
        <h1 className="text-xl font-semibold text-stone-100">My Reviews</h1>
        <p className="mt-0.5 text-sm text-stone-500">{reviews.length} submitted</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-stone-900 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No reviews yet. Reviews can be submitted after each appointment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/8 bg-stone-900">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-stone-100">{r.branch.name}</span>
                  {r.worker && (
                    <span className="text-xs text-stone-500">with {r.worker.firstName} {r.worker.lastName}</span>
                  )}
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                </div>
                <span className="font-mono text-xs text-stone-500">
                  {new Date(r.createdAt).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-[11px] text-stone-500">Overall</span>
                    <p className="text-gold">{"★".repeat(r.overallRating)}<span className="text-stone-700">{"★".repeat(5 - r.overallRating)}</span></p>
                  </div>
                  {r.serviceRating && (
                    <div>
                      <span className="text-[11px] text-stone-500">Service</span>
                      <p className="text-stone-300">{"★".repeat(r.serviceRating)}<span className="text-stone-700">{"★".repeat(5 - r.serviceRating)}</span></p>
                    </div>
                  )}
                  {r.workerRating && (
                    <div>
                      <span className="text-[11px] text-stone-500">Worker</span>
                      <p className="text-stone-300">{"★".repeat(r.workerRating)}<span className="text-stone-700">{"★".repeat(5 - r.workerRating)}</span></p>
                    </div>
                  )}
                </div>
                {r.comment && <p className="mt-2 text-sm text-stone-400">{r.comment}</p>}
                {r.adminReply && (
                  <div className="mt-3 rounded-lg border border-white/8 bg-stone-800 px-3 py-2">
                    <p className="text-[11px] font-medium text-stone-500">Response from {r.branch.name}</p>
                    <p className="mt-1 text-xs text-stone-400">{r.adminReply}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
