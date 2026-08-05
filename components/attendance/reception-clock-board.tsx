"use client";

// ============================================================================
// MODULE : Attendance — reception clock board
//
// The front desk's job, as a board rather than a form: every active employee in
// the branch, one row each, with exactly the buttons that are legal for their
// CURRENT state. Someone who has not arrived shows only "Clock in"; someone on a
// break shows only "End break".
//
// The button set mirrors the server's clockConflict() state machine, so the UI
// never offers an action the API would answer 409 to. When the two ever disagree —
// two receptionists on the same row — the API wins and the error is shown inline.
//
// Reception deliberately has NO edit and NO delete here. Those capabilities are
// false for the role on the server; leaving the controls out is the honest
// reflection of that, not the enforcement of it.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Coffee, CoffeeIcon, Loader2, UserX, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { AttendanceEmpty, AttendanceStatusBadge } from "@/components/attendance/attendance-ui";
import {
  formatMinutes,
  formatTime,
  type AttendanceRow,
  type WorkerOption,
} from "@/components/attendance/types";

type ClockAction = "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END";

type BoardWorker = WorkerOption & { designation: string | null };

const btnBase =
  "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition " +
  "focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const ACTION_STYLES: Record<ClockAction, string> = {
  CHECK_IN: "bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900/20 dark:bg-white dark:text-gray-900",
  CHECK_OUT: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-900/10 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)",
  BREAK_START: "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus:ring-gray-900/10 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)",
  BREAK_END: "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-500/20 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
};

const ACTION_LABEL: Record<ClockAction, string> = {
  CHECK_IN: "Clock in",
  CHECK_OUT: "Clock out",
  BREAK_START: "Start break",
  BREAK_END: "End break",
};

const ACTION_ICON: Record<ClockAction, React.ComponentType<{ className?: string }>> = {
  CHECK_IN: LogIn,
  CHECK_OUT: LogOut,
  BREAK_START: Coffee,
  BREAK_END: CoffeeIcon,
};

/**
 * The actions legal for a row's current state.
 *
 * Mirrors clockConflict() on the server exactly. Kept as one pure function so the
 * two can be compared side by side rather than being scattered across JSX guards.
 */
function availableActions(record: AttendanceRow | undefined): ClockAction[] {
  if (!record?.checkIn) return ["CHECK_IN"];
  if (record.checkOut) return [];

  const onBreak = Boolean(record.breakStart) && !record.breakEnd;
  if (onBreak) return ["BREAK_END"];

  // Only one break per day is supported, so the option disappears once taken.
  const breakTaken = Boolean(record.breakStart) && Boolean(record.breakEnd);
  return breakTaken ? ["CHECK_OUT"] : ["CHECK_OUT", "BREAK_START"];
}

function stateLabel(record: AttendanceRow | undefined): { text: string; cls: string } {
  if (!record?.checkIn) return { text: "Not arrived", cls: "text-gray-400 dark:text-(--sa-muted)" };
  if (record.checkOut) return { text: "Clocked out", cls: "text-gray-500 dark:text-(--sa-text-2)" };
  if (record.breakStart && !record.breakEnd) return { text: "On break", cls: "text-amber-700 dark:text-amber-400" };
  return { text: "On shift", cls: "text-emerald-700 dark:text-emerald-400" };
}

export function ReceptionClockBoard({
  workers,
  records,
  endpoint,
  date,
}: {
  workers: BoardWorker[];
  /** Today's rows, keyed by workerId. */
  records: Record<string, AttendanceRow>;
  endpoint: string;
  date: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  async function run(workerId: string, action: ClockAction) {
    if (busy) return;
    setBusy(`${workerId}:${action}`);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[workerId];
      return next;
    });

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, action }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success: boolean; message?: string }
        | null;

      if (!res.ok || !body?.success) {
        setErrors((prev) => ({
          ...prev,
          [workerId]: body?.message || `Could not ${ACTION_LABEL[action].toLowerCase()}`,
        }));
        return;
      }

      router.refresh();
    } catch {
      setErrors((prev) => ({
        ...prev,
        [workerId]: "Could not reach the server. Check your connection and try again.",
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff on duty</CardTitle>
        <span className="text-xs text-gray-400 dark:text-(--sa-muted)">{date}</span>
      </CardHeader>

      <Table>
        <THead>
          <tr>
            <TH>Employee</TH>
            <TH>State</TH>
            <TH>Check In</TH>
            <TH>Check Out</TH>
            <TH>Break</TH>
            <TH>Working</TH>
            <TH>Status</TH>
            <TH>Actions</TH>
          </tr>
        </THead>
        <tbody>
          {workers.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <AttendanceEmpty
                  icon={UserX}
                  title="No active employees in this branch"
                  hint="Employees appear here once they are assigned to your branch."
                />
              </td>
            </tr>
          ) : (
            workers.map((worker) => {
              const record = records[worker.id];
              const actions = availableActions(record);
              const state = stateLabel(record);
              const error = errors[worker.id];

              return (
                <TR key={worker.id}>
                  <TD>
                    <span className="block text-sm text-gray-800 dark:text-(--sa-text)">{worker.name}</span>
                    <span className="block font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">
                      {worker.employeeCode}
                      {worker.designation ? ` · ${worker.designation}` : ""}
                    </span>
                    {error && (
                      <span className="mt-1 flex items-start gap-1 text-[11px] text-red-600 dark:text-red-400">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        {error}
                      </span>
                    )}
                  </TD>

                  <TD className={cn("whitespace-nowrap text-xs font-medium", state.cls)}>{state.text}</TD>

                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatTime(record?.checkIn ?? null)}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatTime(record?.checkOut ?? null)}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {record && record.breakMinutes > 0 ? formatMinutes(record.breakMinutes) : "—"}
                  </TD>
                  <TD className="whitespace-nowrap text-xs font-medium text-gray-800 dark:text-(--sa-text)">
                    {record ? formatMinutes(record.workingMinutes) : "—"}
                  </TD>

                  <TD className="whitespace-nowrap">
                    {record ? (
                      <AttendanceStatusBadge status={record.status} />
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-(--sa-muted)">Not marked</span>
                    )}
                  </TD>

                  <TD className="whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {actions.length === 0 ? (
                        <span className="text-xs text-gray-300 dark:text-(--sa-muted)">Day complete</span>
                      ) : (
                        actions.map((action) => {
                          const Icon = ACTION_ICON[action];
                          const key = `${worker.id}:${action}`;
                          const isBusy = busy === key;
                          return (
                            <button
                              key={action}
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void run(worker.id, action)}
                              className={cn(btnBase, ACTION_STYLES[action])}
                            >
                              {isBusy ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Icon className="size-3" aria-hidden="true" />
                              )}
                              {ACTION_LABEL[action]}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })
          )}
        </tbody>
      </Table>
    </Card>
  );
}
