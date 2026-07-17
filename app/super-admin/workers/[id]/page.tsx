import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { getWorkerWorkspace } from "@/lib/worker-workspace";
import { WorkerProfileView } from "@/components/worker-workspace/worker-profile-view";
import { Workspace } from "@/components/worker-workspace/workspace";

// OWNER: Hemant | MODULE: Super Admin — Worker Detail
//
// A single rich worker profile: identity hero, headline KPIs, recent work,
// portfolio, services, and a Profile Information rail (status, specializations,
// languages, rating, certificates, assigned branches, availability). All data
// comes from the shared branch-scoped fetch in lib/worker-workspace — no Prisma
// here. proxy.ts admits SUPER_ADMIN + OWNER to /super-admin/*, so both are allowed
// (a plain === SUPER_ADMIN check used to bounce a legitimately-authenticated OWNER).

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  const { id } = await params;
  const data = await getWorkerWorkspace(id, authUser);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/super-admin/workers"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back to workers
      </Link>

      <WorkerProfileView data={data} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-1">
          <h2 className="text-base font-semibold text-gray-900">
            Worker details
          </h2>
          <p className="text-xs text-gray-500">
            Portfolio, schedule, attendance, leave, services, performance and records.
          </p>
        </div>
        <Workspace data={data} includeOverview={false} />
      </section>
    </div>
  );
}
