"use client";

// ============================================================================
// MODULE : Attendance — records list + actions
//
// The workspace: action bar, the records list, row actions and the four dialogs.
// Capabilities arrive as props from the page, which reads them from the SERVER's
// own capabilitiesFor() — so the buttons a role sees always match what the API
// will actually let them do. Hiding a button is presentation; the API is still the
// thing that enforces it, and a hand-crafted request gets the same 403.
//
// LAYOUT. Sixteen one-fact columns made every row a horizontal scroll. Related
// facts now share a cell — date with shift, in with out, hours with late/overtime,
// status with how the entry was made and its approval — so a desktop row fits
// without scrolling, and below the md breakpoint each record becomes a card.
//
// Export is a plain <a download> onto GET …/attendance/export carrying the CURRENT
// query string, so the file always contains exactly the rows on screen.
// ============================================================================

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  CalendarX2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  ListChecks,
  Lock,
  Pencil,
  Table2,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import {
  AttendanceEmpty,
  AttendanceStatusBadge,
  ApprovalBadge,
} from "@/components/attendance/attendance-ui";
import {
  BulkAttendanceDialog,
  DeleteAttendanceDialog,
  EditAttendanceDialog,
  MarkAttendanceDialog,
} from "@/components/attendance/attendance-dialogs";
import {
  formatDate,
  formatMinutes,
  formatTime,
  formatWeekday,
  workerName,
  type AttendanceRow,
  type WorkerOption,
} from "@/components/attendance/types";

export type AttendanceCapabilities = {
  canMark: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBulk: boolean;
  canApproveOvertime: boolean;
  canLock: boolean;
  canBackdate: boolean;
};

export type AttendanceEndpoints = {
  /** POST target for marking (role-appropriate door). */
  mark: string;
  /** POST target for bulk marking. */
  bulk: string;
  /** Base path for PATCH / DELETE record mutations. */
  recordBase: string;
  /** GET target for downloads. */
  export: string;
};

const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-gray-900 px-3 text-sm font-medium text-white transition " +
  "hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100";

const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition " +
  "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2) dark:hover:bg-white/5";

const exportSegment =
  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 px-3 text-sm text-gray-600 transition hover:bg-gray-50 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 sm:flex-none " +
  "dark:text-(--sa-text-2) dark:hover:bg-white/5";

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded text-gray-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

const muted = "text-gray-400 dark:text-(--sa-muted)";

// ── Cell pieces, shared by the desktop table and the mobile cards ─────────────

function initials(row: AttendanceRow): string {
  const letters = workerName(row.worker)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

function Avatar({ row }: { row: AttendanceRow }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-(--sa-text-2)"
    >
      {initials(row)}
    </span>
  );
}

/** Late / overtime as small chips — absent when there is nothing to say. */
function HoursChips({ row }: { row: AttendanceRow }) {
  if (row.lateMinutes <= 0 && row.overtimeMinutes <= 0) return null;
  return (
    <>
      {row.lateMinutes > 0 && (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {row.lateMinutes}m late
        </span>
      )}
      {row.overtimeMinutes > 0 && (
        <span
          className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          title={row.overtimeApproved ? "Overtime approved" : "Overtime not yet approved"}
        >
          {row.overtimeMinutes}m OT{row.overtimeApproved ? " ✓" : ""}
        </span>
      )}
    </>
  );
}

/** How the record came to exist, plus its approval state when a person made it. */
function Provenance({ row }: { row: AttendanceRow }) {
  if (!row.isManual) {
    return <span className={cn("text-[11px]", muted)}>Automatic</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-gray-600 dark:text-(--sa-text-2)">Manual</span>
      <ApprovalBadge isManual approvedAt={row.approvedAt} approvedByName={row.approvedByName} />
    </span>
  );
}

function markedByLabel(row: AttendanceRow): string {
  return row.markedByName ?? (row.markedBy ? "—" : "Self");
}

function RowActions({
  row,
  capabilities,
  onEdit,
  onDelete,
}: {
  row: AttendanceRow;
  capabilities: AttendanceCapabilities;
  onEdit: (row: AttendanceRow) => void;
  onDelete: (row: AttendanceRow) => void;
}) {
  const who = `${workerName(row.worker)} on ${formatDate(row.date)}`;
  return (
    <div className="flex items-center justify-end gap-0.5">
      {capabilities.canEdit && (
        <button
          type="button"
          onClick={() => onEdit(row)}
          aria-label={`Edit ${who}`}
          title="Edit"
          className={cn(iconBtn, "hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-(--sa-text)")}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      {capabilities.canDelete && (
        <button
          type="button"
          onClick={() => onDelete(row)}
          aria-label={`Delete ${who}`}
          title="Delete"
          className={cn(iconBtn, "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10")}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function AttendanceView({
  rows,
  total,
  page,
  limit,
  totalPages,
  workers,
  capabilities,
  endpoints,
  showBranch = false,
}: {
  rows: AttendanceRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  workers: WorkerOption[];
  capabilities: AttendanceCapabilities;
  endpoints: AttendanceEndpoints;
  /** Global roles see several branches, so each record names its branch. */
  showBranch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [markOpen, setMarkOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = React.useState<AttendanceRow | null>(null);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  /** The export URL carries the live filters so the download matches the view. */
  function exportHref(format: "csv" | "excel" | "pdf") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("limit");
    params.set("format", format);
    return `${endpoints.export}?${params.toString()}`;
  }

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const showActions = capabilities.canEdit || capabilities.canDelete;

  // Explain "Pending approval" to the people who see it but cannot clear it.
  const showApprovalNote =
    !capabilities.canApproveOvertime && rows.some((row) => row.isManual && !row.approvedAt);

  return (
    <>
      {/* Action bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {(capabilities.canMark || capabilities.canBulk) && (
          <div className="flex gap-2">
            {capabilities.canMark && (
              <button type="button" onClick={() => setMarkOpen(true)} className={cn(btnPrimary, "flex-1 sm:flex-none")}>
                <CalendarPlus className="size-3.5" aria-hidden="true" /> Mark attendance
              </button>
            )}
            {capabilities.canBulk && (
              <button type="button" onClick={() => setBulkOpen(true)} className={cn(btnGhost, "flex-1 sm:flex-none")}>
                <ListChecks className="size-3.5" aria-hidden="true" /> Bulk mark
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          <span className={cn("hidden items-center gap-1 text-xs lg:inline-flex", muted)}>
            <Download className="size-3.5" aria-hidden="true" /> Export
          </span>
          <div
            role="group"
            aria-label="Export records"
            className="flex flex-1 divide-x divide-gray-200 overflow-hidden rounded border border-gray-200 bg-white sm:flex-none dark:divide-(--sa-border) dark:border-(--sa-border) dark:bg-(--sa-surface)"
          >
            <a href={exportHref("csv")} download className={exportSegment}>
              <Table2 className="size-3.5" aria-hidden="true" /> CSV
            </a>
            <a href={exportHref("excel")} download className={exportSegment}>
              <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Excel
            </a>
            <a href={exportHref("pdf")} download className={exportSegment}>
              <FileText className="size-3.5" aria-hidden="true" /> PDF
            </a>
          </div>
        </div>
      </div>

      {showApprovalNote && (
        <div className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
          <Info className="mt-0.5 size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          <p>
            <span className="font-medium text-gray-800 dark:text-(--sa-text)">Pending approval</span> marks an entry that
            was added or corrected by hand. It stays editable, and a Super Admin or Owner reviews and approves it.
          </p>
        </div>
      )}

      {/* Desktop table */}
      <Card className={cn("hidden overflow-hidden transition-opacity md:block", isPending && "opacity-60")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Employee</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Date &amp; shift</th>
                <th scope="col" className="px-4 py-2.5 font-medium">In → Out</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Hours</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Marked by</th>
                {showActions && (
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-(--sa-border)">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showActions ? 7 : 6}>
                    <AttendanceEmpty
                      icon={CalendarX2}
                      title="No attendance records"
                      hint="Nothing matches these filters. Try widening the date range, or mark attendance to get started."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top transition-colors hover:bg-gray-50/70 dark:hover:bg-(--sa-hover)">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar row={row} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{workerName(row.worker)}</p>
                          <p className={cn("truncate font-mono text-[11px]", muted)}>
                            {row.worker.employeeCode}
                            {row.worker.designation ? ` · ${row.worker.designation.name}` : ""}
                          </p>
                          {showBranch && (
                            <p className="truncate text-[11px] text-gray-500 dark:text-(--sa-text-2)">{row.branch.name}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-gray-800 dark:text-(--sa-text)">
                        {formatDate(row.date)} <span className={cn("text-xs", muted)}>{formatWeekday(row.date)}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-(--sa-text-2)">
                        {row.shift ? `${row.shift.name} · ${row.shift.startTime}–${row.shift.endTime}` : "No shift"}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-mono text-sm text-gray-800 dark:text-(--sa-text)">
                        {formatTime(row.checkIn)} <span className={muted}>→</span> {formatTime(row.checkOut)}
                      </p>
                      {row.breakMinutes > 0 && (
                        <p className={cn("text-[11px]", muted)}>Break {formatMinutes(row.breakMinutes)}</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap font-medium text-gray-900 dark:text-(--sa-text)">
                        {formatMinutes(row.workingMinutes)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <HoursChips row={row} />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <AttendanceStatusBadge status={row.status} />
                        {row.isLocked && (
                          <Lock className={cn("size-3", muted)} aria-label="Locked for payroll" />
                        )}
                      </span>
                      <div className="mt-1">
                        <Provenance row={row} />
                      </div>
                    </td>

                    <td className="max-w-48 px-4 py-3">
                      <p className="truncate text-gray-700 dark:text-(--sa-text)">{markedByLabel(row)}</p>
                      {row.isManual && row.manualReason && (
                        // The reason is the whole point of a manual entry, so it is
                        // shown inline rather than hidden behind the row menu.
                        <p className={cn("truncate text-[11px]", muted)} title={row.manualReason}>
                          {row.manualReason}
                        </p>
                      )}
                    </td>

                    {showActions && (
                      <td className="px-3 py-2.5">
                        <RowActions row={row} capabilities={capabilities} onEdit={setEditing} onDelete={setDeleting} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className={cn("space-y-2 transition-opacity md:hidden", isPending && "opacity-60")}>
        {rows.length === 0 ? (
          <Card>
            <AttendanceEmpty
              icon={CalendarX2}
              title="No attendance records"
              hint="Nothing matches these filters. Try widening the date range, or mark attendance to get started."
            />
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="p-3.5">
              <div className="flex items-start gap-3">
                <Avatar row={row} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                        {workerName(row.worker)}
                      </p>
                      <p className={cn("truncate text-[11px]", muted)}>
                        {formatDate(row.date)} · {formatWeekday(row.date)}
                        {row.shift ? ` · ${row.shift.name}` : ""}
                        {showBranch ? ` · ${row.branch.name}` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <AttendanceStatusBadge status={row.status} />
                      {row.isLocked && <Lock className={cn("size-3", muted)} aria-label="Locked for payroll" />}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded bg-gray-50 px-3 py-2 text-center dark:bg-white/5">
                    <div>
                      <dt className={cn("text-[10px] uppercase tracking-wide", muted)}>In</dt>
                      <dd className="font-mono text-sm text-gray-800 dark:text-(--sa-text)">{formatTime(row.checkIn)}</dd>
                    </div>
                    <div>
                      <dt className={cn("text-[10px] uppercase tracking-wide", muted)}>Out</dt>
                      <dd className="font-mono text-sm text-gray-800 dark:text-(--sa-text)">{formatTime(row.checkOut)}</dd>
                    </div>
                    <div>
                      <dt className={cn("text-[10px] uppercase tracking-wide", muted)}>Worked</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-(--sa-text)">{formatMinutes(row.workingMinutes)}</dd>
                    </div>
                  </dl>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <HoursChips row={row} />
                    <Provenance row={row} />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-(--sa-border)">
                    <p className="min-w-0 truncate text-[11px] text-gray-500 dark:text-(--sa-text-2)">
                      By {markedByLabel(row)}
                      {row.isManual && row.manualReason ? ` · ${row.manualReason}` : ""}
                    </p>
                    {showActions && (
                      <RowActions row={row} capabilities={capabilities} onEdit={setEditing} onDelete={setDeleting} />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col items-center gap-2 rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 sm:flex-row sm:justify-between dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)">
          <span>
            Showing {from}–{to} of {total}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="h-8 rounded border border-gray-200 px-3 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="h-8 rounded border border-gray-200 px-3 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {capabilities.canMark && (
        <MarkAttendanceDialog
          open={markOpen}
          onClose={() => setMarkOpen(false)}
          endpoint={endpoints.mark}
          workers={workers}
          canBackdate={capabilities.canBackdate}
        />
      )}

      {capabilities.canBulk && (
        <BulkAttendanceDialog
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          bulkEndpoint={endpoints.bulk}
          workers={workers}
        />
      )}

      {capabilities.canEdit && (
        <EditAttendanceDialog
          row={editing}
          onClose={() => setEditing(null)}
          recordBaseEndpoint={endpoints.recordBase}
          canApproveOvertime={capabilities.canApproveOvertime}
          canLock={capabilities.canLock}
        />
      )}

      {capabilities.canDelete && (
        <DeleteAttendanceDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          recordBaseEndpoint={endpoints.recordBase}
        />
      )}
    </>
  );
}
