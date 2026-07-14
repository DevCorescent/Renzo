import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated } from "@/lib/api-server";
import { PageHeader } from "@/components/shared/ui";
import { WorkerForm } from "@/components/workers/worker-form";
import { maxDateOfBirth } from "@/lib/worker-form-schema";

// OWNER: Hemant | MODULE: Branch Admin — Add Worker
//
// BACKEND: POST /api/v1/admin/workers
//
// The page never touches Prisma, and never renders or submits a branchId: the
// route takes the branch from the caller's JWT for a BRANCH_ADMIN and ignores the
// body, so the UI is not load-bearing for that guarantee.

type Lookup = { id: string; name: string };

/**
 * NOTHING IN HERE MAY THROW.
 *
 * Designation and department are OPTIONAL on POST, and their list endpoints
 * (GET /admin/designations, /admin/departments) are SUPER_ADMIN/OWNER only — a
 * BRANCH_ADMIN gets a 403. They are a nicety; the page must not depend on them.
 *
 * allSettled rather than all: a rejected promise in Promise.all propagates and
 * takes the whole Server Component down with a 500. apiGet no longer throws, so
 * this is belt AND braces — but the page that admits staff is not the place to
 * rely on a single layer.
 *
 * If those two routes are ever widened to BRANCH_ADMIN, the selects light up on
 * their own. No change is needed here.
 */
async function loadLookups(): Promise<{ designations: Lookup[]; departments: Lookup[] }> {
  const [designations, departments] = await Promise.allSettled([
    apiGet<Paginated<Lookup>>("/api/v1/admin/designations?limit=100"),
    apiGet<Paginated<Lookup>>("/api/v1/admin/departments?limit=100"),
  ]);

  const items = (
    settled: PromiseSettledResult<Awaited<ReturnType<typeof apiGet<Paginated<Lookup>>>>>
  ): Lookup[] =>
    settled.status === "fulfilled" && settled.value.ok ? settled.value.data.items : [];

  return {
    designations: items(designations),
    departments: items(departments),
  };
}

export default async function NewWorkerPage() {
  const authUser = await getServerUser();

  // proxy.ts gates /branch-admin/* already; this is the second line and the API is
  // the third. A branch admin with no branch is refused by all three.
  if (!authUser?.branchId) redirect("/login");

  const { designations, departments } = await loadLookups();

  // Both derived HERE, on the server, and handed to the client component. Calling
  // new Date() during a client render would disagree with the server's value for a
  // request that straddles midnight, and React would flag a hydration mismatch.
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/branch-admin/workers"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back to workers
      </Link>

      <PageHeader
        eyebrow="Team"
        title="Add worker"
        subtitle="They are admitted to your branch automatically and can sign in with the phone and password you set."
      />

      <WorkerForm
        designations={designations}
        departments={departments}
        maxDateOfBirth={maxDateOfBirth(now)}
        today={todayIso}
      />
    </div>
  );
}
