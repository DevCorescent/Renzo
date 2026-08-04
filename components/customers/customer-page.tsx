// ============================================================================
// MODULE : Customers — the shared server page
//
// Super Admin, Branch Admin and Reception render the SAME page; they differ only
// in the endpoint prefix they call and the capabilities their role carries. Three
// copies of this fetch-and-render is how one of them eventually stops filtering
// by branch, so there is one copy and the role is a parameter.
//
// Server Component: it loads the first page of customers and the branch list on
// the server, then hands plain data to the client table.
// ============================================================================

import { apiGet, type Paginated } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { PageHeader } from "@/components/shared/ui";
import { CustomerView } from "@/components/customers/customer-view";
import {
  customerCapabilitiesFor,
  type BranchOption,
  type CustomerRow,
} from "@/components/customers/types";
import type { UserType } from "@/types/api";

/** Next passes search params as string | string[] | undefined. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v[0] ?? "" : v ?? "";

/** Forward only the filters the API understands — never the whole query string. */
const FORWARDED = [
  "search",
  "customerType",
  "entrySource",
  "entryType",
  "membership",
  "includeDeleted",
  "sortBy",
  "sortOrder",
  "page",
] as const;

export type CustomerSurface = {
  userType: UserType;
  /** e.g. "/super-admin/customers" — also the profile link base. */
  basePath: string;
  /** Which API prefix this role calls. */
  endpoint: string;
  /** Where "Book appointment" goes from the duplicate prompt, if the role has one. */
  bookingPath: string | null;
  eyebrow: string;
  subtitle: string;
};

export async function CustomersPage({
  surface,
  searchParams,
}: {
  surface: CustomerSurface;
  searchParams: RawSearchParams;
}) {
  const query = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = first(searchParams[key]);
    if (value) query.set(key, value);
  }
  query.set("limit", "25");

  const [listResult, branchResult] = await Promise.all([
    apiGet<Paginated<CustomerRow>>(`${surface.endpoint}?${query.toString()}`),
    // Only a role that may CHOOSE a branch needs the list; for everyone else the
    // field is read-only and one fewer request is one fewer thing to wait for.
    customerCapabilitiesFor(surface.userType).canChooseBranch
      ? apiGet<Paginated<BranchOption> | BranchOption[]>(`${API.admin.branches}?limit=100`)
      : Promise.resolve(null),
  ]);

  const capability = customerCapabilitiesFor(surface.userType);

  const branches: BranchOption[] = (() => {
    if (!branchResult?.ok) return [];
    const data = branchResult.data;
    const items = Array.isArray(data) ? data : data.items;
    return items.map((b) => ({ id: b.id, name: b.name }));
  })();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={surface.eyebrow} title="Customers" subtitle={surface.subtitle} />

      {!listResult.ok ? (
        <p className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {listResult.status === 403
            ? "You do not have access to the customer list."
            : listResult.message || "Could not load customers."}
        </p>
      ) : (
        <CustomerView
          rows={listResult.data.items}
          total={listResult.data.total}
          page={listResult.data.page}
          totalPages={listResult.data.totalPages}
          branches={branches}
          capability={capability}
          endpoint={surface.endpoint}
          exportEndpoint={API.admin.customerExport}
          importEndpoint={API.admin.customerImport}
          profileBasePath={surface.basePath}
          bookingPath={surface.bookingPath}
        />
      )}
    </div>
  );
}
