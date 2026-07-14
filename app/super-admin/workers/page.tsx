import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated, type WorkerListItem } from "@/lib/api-server";
import { WorkersDirectory } from "@/components/workers/workers-directory";
import { EmptyState } from "@/components/workers/worker-ui";
import { Card } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: All Workers
//
// BACKEND: GET /api/v1/admin/workers  — unscoped for platform roles, optionally
//          narrowed with ?branchId=.
//
// proxy.ts admits BOTH roles to /super-admin/* — { roles: ["SUPER_ADMIN", "OWNER"] }.
// The previous check here demanded userType === "SUPER_ADMIN", so an OWNER cleared
// the proxy and was then bounced back to /login from a page they had just been
// authenticated for.
const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

const PASSTHROUGH = [
  "search",
  "isActive",
  "isPublic",
  "gender",
  "branchId",
  "departmentId",
  "designationId",
  "sortBy",
  "sortOrder",
  "page",
  "limit",
] as const;

export default async function SuperAdminWorkersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();

  if (
    !authUser ||
    !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])
  ) {
    redirect("/login");
  }

  const raw = await searchParams;

  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    const value = raw[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v?.trim()) params.set(key, v.trim());
  }

  const result = await apiGet<Paginated<WorkerListItem>>(
    `/api/v1/admin/workers?${params.toString()}`
  );

  if (!result.ok) {
    return (
      <Card>
        <EmptyState title="Could not load workers" hint={result.message} />
      </Card>
    );
  }

  return (
    <WorkersDirectory
      data={result.data}
      basePath="/super-admin/workers"
      title="Workers"
      subtitle={`${result.data.total} across all branches`}
      params={params}
      canManage={false}
    />
  );
}
