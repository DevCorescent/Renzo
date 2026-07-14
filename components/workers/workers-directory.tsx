// The Workers list. Server Component — renders what GET /api/v1/admin/workers
// returned, and nothing it did not.
//
// Shared by Branch Admin and Super Admin so the two cannot drift. The only
// difference is scope, and scope is enforced by the API from the session cookie,
// not by this component.

import Link from "next/link";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/shared/ui";
import { WorkerAvatar, EmptyState } from "./worker-ui";
import { WorkersToolbar } from "./workers-toolbar";
import { WorkerRowActions } from "./worker-row-actions";
import { cn } from "@/lib/utils";
import type { Paginated, WorkerListItem } from "@/lib/api-server";

/** Exactly the four values GET /api/v1/admin/workers whitelists in SORTABLE_FIELDS. */
const SORTABLE = {
  firstName: "Worker",
  employeeCode: "Code",
  joinDate: "Joined",
  createdAt: "Added",
} as const;

type SortKey = keyof typeof SORTABLE;

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

/** A plain <Link>, so sorting survives JS being off and a sorted view is shareable. */
function SortHeader({
  column,
  current,
  order,
  params,
  className,
}: {
  column: SortKey;
  current: string;
  order: string;
  params: URLSearchParams;
  className?: string;
}) {
  const isActive = current === column;
  const nextOrder = isActive && order === "asc" ? "desc" : "asc";

  const next = new URLSearchParams(params.toString());
  next.set("sortBy", column);
  next.set("sortOrder", nextOrder);
  next.delete("page");

  return (
    <TH
      className={className}
      aria-sort={isActive ? (order === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={`?${next.toString()}`}
        scroll={false}
        className="inline-flex items-center gap-1 rounded transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      >
        {SORTABLE[column]}
        <span
          aria-hidden="true"
          className={cn("text-[9px]", isActive ? "text-gray-900" : "text-gray-300")}
        >
          {isActive ? (order === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </TH>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  limit,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  params: URLSearchParams;
}) {
  if (total === 0) return null;

  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `?${next.toString()}`;
  };

  const linkCls =
    "inline-flex h-8 items-center rounded border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-500">
        <span className="font-medium tabular-nums text-gray-700">
          {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
        </span>{" "}
        of <span className="font-medium tabular-nums text-gray-700">{total}</span>
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={href(page - 1)} scroll={false} className={linkCls} rel="prev">
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkCls, "cursor-not-allowed opacity-40")}>
            Previous
          </span>
        )}

        <span className="px-2 text-xs tabular-nums text-gray-500">
          {page} / {Math.max(totalPages, 1)}
        </span>

        {page < totalPages ? (
          <Link href={href(page + 1)} scroll={false} className={linkCls} rel="next">
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkCls, "cursor-not-allowed opacity-40")}>
            Next
          </span>
        )}
      </nav>
    </div>
  );
}

export function WorkersDirectory({
  data,
  basePath,
  title,
  subtitle,
  params,
  action,
  designations,
  departments,
  canManage,
}: {
  data: Paginated<WorkerListItem>;
  basePath: string;
  title: string;
  subtitle: string;
  params: URLSearchParams;
  /** The Add Worker drawer, injected by the page — only roles the API lets create. */
  action?: React.ReactNode;
  designations?: { value: string; label: string }[];
  departments?: { value: string; label: string }[];
  canManage: boolean;
}) {
  const { items, total, page, limit, totalPages } = data;

  const sortBy = params.get("sortBy") ?? "createdAt";
  const sortOrder = params.get("sortOrder") ?? "desc";

  const isFiltered = [...params.keys()].some(
    (k) => !["page", "limit", "sortBy", "sortOrder"].includes(k)
  );

  // Counted from the CURRENT PAGE only, and labelled as such. The list endpoint
  // returns one page plus a total; it does not return a breakdown by status, and
  // fabricating a platform-wide "Active" count from twenty rows would be a lie the
  // user would act on.
  const activeOnPage = items.filter((w) => w.isActive).length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Team" title={title} subtitle={subtitle} actions={action} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Workers" value={total} hint="matching current filters" />
        <Tile label="Active on this page" value={activeOnPage} hint={`of ${items.length} shown`} />
        <Tile label="Page" value={`${page} / ${Math.max(totalPages, 1)}`} />
        <Tile label="Per page" value={limit} />
      </div>

      <WorkersToolbar designations={designations} departments={departments} />

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title={isFiltered ? "No workers match these filters" : "No workers yet"}
            hint={
              isFiltered
                ? "Try clearing a filter or widening your search."
                : "Workers you add will appear here."
            }
            action={!isFiltered ? action : undefined}
          />
        ) : (
          <>
            <Table>
              <THead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <tr>
                  <SortHeader column="firstName" current={sortBy} order={sortOrder} params={params} />
                  <SortHeader
                    column="employeeCode"
                    current={sortBy}
                    order={sortOrder}
                    params={params}
                    className="hidden md:table-cell"
                  />
                  <TH className="hidden lg:table-cell">Designation</TH>
                  <TH className="hidden xl:table-cell">Department</TH>
                  <TH className="hidden lg:table-cell">Experience</TH>
                  <TH className="hidden md:table-cell">Branch</TH>
                  <TH>Status</TH>
                  <SortHeader
                    column="joinDate"
                    current={sortBy}
                    order={sortOrder}
                    params={params}
                    className="hidden xl:table-cell"
                  />
                  <TH className="w-10 text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>

              <tbody>
                {items.map((w) => {
                  const primary =
                    w.branches.find((b) => b.isPrimary && b.isActive) ??
                    w.branches.find((b) => b.isActive) ??
                    null;

                  return (
                    <TR key={w.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <WorkerAvatar
                            id={w.id}
                            firstName={w.firstName}
                            lastName={w.lastName}
                            photo={w.profilePhoto}
                          />
                          <div className="min-w-0">
                            <Link
                              href={`${basePath}/${w.id}`}
                              className="block truncate font-medium text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                            >
                              {w.displayName || `${w.firstName} ${w.lastName}`}
                            </Link>
                            <p className="truncate text-[11px] text-gray-400">
                              {w.phone ?? w.email ?? "—"}
                            </p>
                          </div>
                        </div>
                      </TD>

                      <TD className="hidden font-mono text-xs text-gray-400 md:table-cell">
                        {w.employeeCode}
                      </TD>

                      <TD className="hidden text-gray-600 lg:table-cell">
                        {w.designation?.name ?? <span className="text-gray-300">—</span>}
                      </TD>

                      <TD className="hidden text-gray-600 xl:table-cell">
                        {w.department?.name ?? <span className="text-gray-300">—</span>}
                      </TD>

                      <TD className="hidden tabular-nums text-gray-600 lg:table-cell">
                        {w.experience}y
                      </TD>

                      <TD className="hidden md:table-cell">
                        {primary ? (
                          <div>
                            <p className="text-xs text-gray-700">{primary.branch.name}</p>
                            <p className="font-mono text-[11px] text-gray-400">
                              {primary.branch.code}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">Unassigned</span>
                        )}
                      </TD>

                      <TD>
                        <Badge tone={w.isActive ? "success" : "neutral"}>
                          {w.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TD>

                      <TD className="hidden font-mono text-[11px] text-gray-400 xl:table-cell">
                        {w.joinDate.slice(0, 10)}
                      </TD>

                      <TD className="text-right">
                        <WorkerRowActions
                          workerId={w.id}
                          basePath={basePath}
                          workerName={`${w.firstName} ${w.lastName}`}
                          isActive={w.isActive}
                          canManage={canManage}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              params={params}
            />
          </>
        )}
      </Card>
    </div>
  );
}
