"use client";

// ============================================================================
// MODULE : Attendance — table + actions
//
// The workspace: action bar, the thirteen-column table, row actions and the four
// dialogs. Capabilities arrive as props from the page, which reads them from the
// SERVER's own capabilitiesFor() — so the buttons a role sees always match what
// the API will actually let them do. Hiding a button is presentation; the API is
// still the thing that enforces it, and a hand-crafted request gets the same 403.
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
  ListChecks,
  Lock,
  Pencil,
  Table2,
  Trash2,
} from "lucide-react";
import { Card, Table, THead, TH, TR, TD, Badge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import {
  AttendanceEmpty,
  AttendanceStatusBadge,
  ApprovalBadge,
  EntryTypeBadge,
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
  formatMinutesOrDash,
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
  "inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-3 text-sm font-medium text-white transition " +
  "hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100";

const btnGhost =
  "inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition " +
  "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)";

export function AttendanceView({
  rows,
  total,
  page,
  limit,
  totalPages,
  workers,
  capabilities,
  endpoints,
}: {
  rows: AttendanceRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  workers: WorkerOption[];
  capabilities: AttendanceCapabilities;
  endpoints: AttendanceEndpoints;
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {capabilities.canMark && (
            <button type="button" onClick={() => setMarkOpen(true)} className={btnPrimary}>
              <CalendarPlus className="size-3.5" aria-hidden="true" /> Mark attendance
            </button>
          )}
          {capabilities.canBulk && (
            <button type="button" onClick={() => setBulkOpen(true)} className={btnGhost}>
              <ListChecks className="size-3.5" aria-hidden="true" /> Bulk mark
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-(--sa-muted)">
            <Download className="size-3.5" aria-hidden="true" /> Export
          </span>
          <a href={exportHref("csv")} download className={btnGhost}>
            <Table2 className="size-3.5" aria-hidden="true" /> CSV
          </a>
          <a href={exportHref("excel")} download className={btnGhost}>
            <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Excel
          </a>
          <a href={exportHref("pdf")} download className={btnGhost}>
            <FileText className="size-3.5" aria-hidden="true" /> PDF
          </a>
        </div>
      </div>

      <Card className={cn("transition-opacity", isPending && "opacity-60")}>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Employee</TH>
              <TH>Branch</TH>
              <TH>Shift</TH>
              <TH>Check In</TH>
              <TH>Check Out</TH>
              <TH>Break</TH>
              <TH>Working</TH>
              <TH>Late</TH>
              <TH>Overtime</TH>
              <TH>Status</TH>
              <TH>Entry</TH>
              <TH>Created By</TH>
              <TH>Approval</TH>
              <TH>Marked By</TH>
              {showActions && <TH>Actions</TH>}
            </tr>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 16 : 15}>
                  <AttendanceEmpty
                    icon={CalendarX2}
                    title="No attendance records"
                    hint="Nothing matches these filters. Try widening the date range, or mark attendance to get started."
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-700 dark:text-(--sa-text)">{formatDate(row.date)}</span>
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-(--sa-muted)">{formatWeekday(row.date)}</span>
                  </TD>

                  <TD>
                    <span className="block text-sm text-gray-800 dark:text-(--sa-text)">{workerName(row.worker)}</span>
                    <span className="block font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">
                      {row.worker.employeeCode}
                      {row.worker.designation ? ` · ${row.worker.designation.name}` : ""}
                    </span>
                  </TD>

                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">{row.branch.name}</TD>

                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {row.shift ? (
                      <>
                        <span className="block text-gray-700 dark:text-(--sa-text)">{row.shift.name}</span>
                        <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                          {row.shift.startTime}–{row.shift.endTime}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-300 dark:text-(--sa-muted)">No shift</span>
                    )}
                  </TD>

                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatTime(row.checkIn)}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatTime(row.checkOut)}
                  </TD>

                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {formatMinutesOrDash(row.breakMinutes)}
                  </TD>

                  <TD className="whitespace-nowrap text-xs font-medium text-gray-800 dark:text-(--sa-text)">
                    {formatMinutes(row.workingMinutes)}
                  </TD>

                  <TD className="whitespace-nowrap text-xs">
                    {row.lateMinutes > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">{row.lateMinutes} min</span>
                    ) : (
                      <span className="text-gray-300 dark:text-(--sa-muted)">—</span>
                    )}
                  </TD>

                  <TD className="whitespace-nowrap text-xs">
                    {row.overtimeMinutes > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-sky-700 dark:text-sky-400">{row.overtimeMinutes} min</span>
                        {row.overtimeApproved && <Badge tone="success">OK</Badge>}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-(--sa-muted)">—</span>
                    )}
                  </TD>

                  <TD className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <AttendanceStatusBadge status={row.status} />
                      {row.isLocked && (
                        <Lock className="size-3 text-gray-400 dark:text-(--sa-muted)" aria-label="Locked for payroll" />
                      )}
                    </span>
                  </TD>

                  <TD className="whitespace-nowrap">
                    <EntryTypeBadge isManual={row.isManual} />
                  </TD>

                  <TD className="max-w-45 text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {row.isManual ? (
                      <>
                        <span className="block truncate text-gray-700 dark:text-(--sa-text)">
                          {row.manualCreatedByName ?? row.markedByName ?? "—"}
                        </span>
                        {row.manualReason && (
                          // The reason is the whole point of a manual entry, so it
                          // is shown inline rather than hidden behind the row menu.
                          <span
                            className="block truncate text-[11px] text-gray-400 dark:text-(--sa-muted)"
                            title={row.manualReason}
                          >
                            {row.manualReason}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300 dark:text-(--sa-muted)">—</span>
                    )}
                  </TD>

                  <TD className="whitespace-nowrap text-xs">
                    <ApprovalBadge
                      isManual={row.isManual}
                      approvedAt={row.approvedAt}
                      approvedByName={row.approvedByName}
                    />
                  </TD>

                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {row.markedByName ?? (row.markedBy ? "—" : "Self")}
                  </TD>

                  {showActions && (
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {capabilities.canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            aria-label={`Edit ${workerName(row.worker)} on ${formatDate(row.date)}`}
                            className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {capabilities.canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
                            aria-label={`Delete ${workerName(row.worker)} on ${formatDate(row.date)}`}
                            className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </TD>
                  )}
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)">
          <span>{from}–{to} of {total}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="px-1.5">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
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
