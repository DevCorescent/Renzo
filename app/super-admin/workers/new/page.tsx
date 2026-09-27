import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated } from "@/lib/api-server";
import { PageHeader, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { WorkerForm } from "@/components/workers/worker-form";
import { maxDateOfBirth } from "@/lib/worker-form-schema";
import { BranchSelectorField } from "./branch-selector-field";
import { createWorkerSuperAdminAction } from "../actions";

// OWNER: Hemant | MODULE: Super Admin — Add Worker
//
// Super Admin / Owner variant of the add-worker page. Unlike branch admin,
// a global role has no branchId on their JWT, so they must pick the target
// branch from a dropdown. The selection is submitted as a hidden `branchId`
// field and the API assigns the new worker to that branch.

type Lookup = { id: string; name: string };

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

async function loadLookups() {
  const [designations, departments, branches] = await Promise.allSettled([
    apiGet<Paginated<Lookup>>("/api/v1/admin/designations?limit=100"),
    apiGet<Paginated<Lookup>>("/api/v1/admin/departments?limit=100"),
    apiGet<Paginated<{ id: string; name: string; city: string }>>("/api/v1/admin/branches?limit=100&isActive=true"),
  ]);

  const items = <T,>(
    settled: PromiseSettledResult<Awaited<ReturnType<typeof apiGet<Paginated<T>>>>>
  ): T[] =>
    settled.status === "fulfilled" && settled.value.ok ? settled.value.data.items : [];

  return {
    designations: items(designations),
    departments: items(departments),
    branches: items(branches),
  };
}

export default async function SuperAdminNewWorkerPage() {
  const authUser = await getServerUser();

  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as typeof PLATFORM_ROLES[number])) {
    redirect("/login");
  }

  const { designations, departments, branches } = await loadLookups();

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/super-admin/workers"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back to workers
      </Link>

      <PageHeader
        eyebrow="Team"
        title="Add worker"
        subtitle="Choose a branch, fill in the details, and the worker is admitted immediately."
      />

      <WorkerForm
        designations={designations}
        departments={departments}
        maxDateOfBirth={maxDateOfBirth(now)}
        today={todayIso}
        action={createWorkerSuperAdminAction}
        extraFields={
          <Card>
            <CardHeader><CardTitle>Branch</CardTitle></CardHeader>
            <CardBody>
              <BranchSelectorField branches={branches} />
            </CardBody>
          </Card>
        }
      />
    </div>
  );
}
