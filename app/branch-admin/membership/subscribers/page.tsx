"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X, ChevronDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { API } from "@/lib/endpoints";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/shared/ui";

type MemberStatus = "ACTIVE" | "EXPIRED" | "FROZEN" | "CANCELLED";

type MemberRow = {
  id: string;
  status: MemberStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  purchasedAt: string;
  plan: { id: string; name: string; tier: string };
  customer: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
};

const STATUS_TONE: Record<MemberStatus, "success" | "danger" | "warning" | "neutral"> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  FROZEN: "warning",
  CANCELLED: "danger",
};

const selectCls =
  "h-9 cursor-pointer appearance-none rounded border border-gray-200 bg-white pr-9 pl-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";

export default function MembershipSubscribersPage() {
  const router = useRouter();

  const [rows, setRows] = React.useState<MemberRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const limit = 20;

  const totalPages = Math.ceil(total / limit);

  const load = React.useCallback(async (pg: number, q: string, s: string) => {
    setLoading(true);
    const url = new URL(API.admin.membershipCustomers, window.location.origin);
    url.searchParams.set("page", String(pg));
    url.searchParams.set("limit", String(limit));
    if (q) url.searchParams.set("search", q);
    if (s) url.searchParams.set("status", s);
    try {
      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setRows(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(1, search, status);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">Membership</p>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-(--sa-text)">Active Members</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-(--sa-muted)">
            All customers with a membership at this branch.
          </p>
        </div>
        <Link
          href="/branch-admin/membership"
          className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
        >
          <ArrowLeft className="size-3.5" /> Sell membership
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Subscribers ({total})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded border border-gray-200 bg-white pl-8 pr-8 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="FROZEN">Frozen</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Customer</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>Start</TH>
              <TH>Expires</TH>
              <TH>Auto-renew</TH>
            </tr>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                  {search || status ? "No members match this filter." : "No members yet."}
                </td>
              </tr>
            ) : rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link
                    href={`/branch-admin/customers/${r.customer.id}`}
                    className="font-medium text-gray-900 hover:underline dark:text-(--sa-text)"
                  >
                    {r.customer.firstName} {r.customer.lastName ?? ""}
                  </Link>
                  <p className="text-xs text-gray-400">{r.customer.phone}</p>
                </TD>
                <TD className="text-sm text-gray-700 dark:text-(--sa-text-2)">
                  {r.plan.name}
                  <span className="ml-1.5 text-xs text-gray-400">({r.plan.tier})</span>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </TD>
                <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                  {fmt(r.startDate)}
                </TD>
                <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                  {fmt(r.endDate)}
                </TD>
                <TD className="text-xs">
                  {r.autoRenew
                    ? <Badge tone="info">Yes</Badge>
                    : <span className="text-gray-400">No</span>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-(--sa-border)">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); void load(p, search, status); }}
                className="h-8 rounded border border-gray-200 px-3 text-xs disabled:opacity-40 hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); void load(p, search, status); }}
                className="h-8 rounded border border-gray-200 px-3 text-xs disabled:opacity-40 hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
