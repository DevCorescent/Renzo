"use client";

// ============================================================================
// MODULE : Attendance — mutation dialogs
//
// Mark, Edit, Bulk and Delete. All four talk to the REST API directly (the same
// pattern the existing worker ClockActions uses) rather than through Server
// Actions, because the API is where RBAC, validation and the working-hours engine
// already live. A Server Action wrapper would add a second place for the rules to
// be re-stated and eventually disagree.
//
// Field-level 422s are forwarded verbatim from the route's own validator and
// rendered against the field that produced them, so "Check-out must be after
// check-in" appears under Check out — not as a generic banner.
//
// Times are submitted as bare "HH:mm" and anchored server-side onto the record's
// date in salon-local time. The browser's timezone is never involved, so an admin
// travelling does not shift a stylist's shift.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  formatDate,
  formatTime,
  statusLabel,
  todayKey,
  workerName,
  type AttendanceRow,
  type AttendanceStatus,
  type WorkerOption,
} from "@/components/attendance/types";

// ============================================================================
// SHARED PLUMBING
// ============================================================================

type Envelope = { success: boolean; message: string; errors?: Record<string, string[]> };

type SubmitResult = { ok: boolean; message: string; errors: Record<string, string[]> };

async function submitJson(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<SubmitResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    let envelope: Envelope | null = null;
    try {
      envelope = (await res.json()) as Envelope;
    } catch {
      return { ok: false, message: "Unexpected server response", errors: {} };
    }

    if (!res.ok || !envelope.success) {
      return {
        ok: false,
        message: envelope.message || "Request failed",
        errors: envelope.errors ?? {},
      };
    }

    return { ok: true, message: envelope.message || "Saved", errors: {} };
  } catch {
    return {
      ok: false,
      message: "Could not reach the server. Check your connection and try again.",
      errors: {},
    };
  }
}

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-800 outline-none transition " +
  "focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50 disabled:text-gray-400 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";

const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white " +
  "transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100";

const btnGhost =
  "inline-flex h-9 items-center justify-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 " +
  "transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)";

const btnDanger =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-red-600 px-4 text-sm font-medium text-white " +
  "transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Native <dialog>: focus trap, top layer and Escape handling come for free. */
function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Backdrop click closes; clicks inside the panel must not bubble out.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40",
        "dark:border-(--sa-border) dark:bg-(--sa-surface)",
        wide ? "max-w-3xl" : "max-w-lg"
      )}
    >
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5 dark:border-(--sa-border)">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-muted)">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

function FieldError({ errors, name }: { errors: Record<string, string[]>; name: string }) {
  const list = errors[name];
  if (!list?.length) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{list.join(" ")}</p>;
}

function FormBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-3 flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** "Auto" leaves the status to the engine; anything else is an explicit override. */
function StatusSelect({
  value,
  onChange,
  id,
  allowAuto = true,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  allowAuto?: boolean;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {allowAuto && <option value="">Auto — derive from times</option>}
      {ATTENDANCE_STATUSES.map((s) => (
        <option key={s} value={s}>{statusLabel(s)}</option>
      ))}
    </select>
  );
}

/** Extract "HH:mm" (salon-local) from an ISO instant, for pre-filling a time input. */
function timeInputValue(iso: string | null): string {
  if (!iso) return "";
  const formatted = formatTime(iso);
  return formatted === "—" ? "" : formatted;
}

// ============================================================================
// MARK ATTENDANCE
// ============================================================================

export function MarkAttendanceDialog({
  open,
  onClose,
  endpoint,
  workers,
  canBackdate,
}: {
  open: boolean;
  onClose: () => void;
  /** API.admin.attendance, API.branchAdmin.attendance or API.reception.attendance. */
  endpoint: string;
  workers: WorkerOption[];
  canBackdate: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const [workerId, setWorkerId] = React.useState("");
  const [date, setDate] = React.useState(todayKey());
  const [status, setStatus] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [breakStart, setBreakStart] = React.useState("");
  const [breakEnd, setBreakEnd] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [lateOverride, setLateOverride] = React.useState("");
  const [overtimeOverride, setOvertimeOverride] = React.useState("");

  // Reset the whole form each time the dialog opens, so a previous failed attempt
  // never leaks into the next worker's record.
  //
  // Done during render on an open-transition rather than in an effect: a
  // setState() in an effect body triggers a second render pass with the STALE form
  // still painted for a frame. This is the same render-phase reset the leave
  // module's ReviewModal uses.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setWorkerId("");
      setDate(todayKey());
      setStatus("");
      setCheckIn("");
      setCheckOut("");
      setBreakStart("");
      setBreakEnd("");
      setNotes("");
      setReason("");
      setLateOverride("");
      setOvertimeOverride("");
      setBanner(null);
      setErrors({});
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!workerId) {
      setErrors({ workerId: ["Select an employee"] });
      return;
    }
    // Checked here as well as on the server so the front desk gets the message
    // without a round-trip; the API is still the authority.
    if (reason.trim().length < 3) {
      setErrors({ reason: ["A reason is required for a manual entry"] });
      return;
    }

    setBusy(true);
    setBanner(null);
    setErrors({});

    // "" means the supervisor left the override blank — send null so the engine's
    // own figure stands, rather than 0, which would read as "never late".
    const toOverride = (v: string) => (v.trim() === "" ? null : Number(v));

    const result = await submitJson(endpoint, "POST", {
      workerId,
      date,
      ...(status ? { status } : {}),
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      notes: notes.trim() || null,
      isManual: true,
      reason: reason.trim(),
      lateOverrideMinutes: toOverride(lateOverride),
      overtimeOverrideMinutes: toOverride(overtimeOverride),
    });

    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark attendance" subtitle="Create or update one employee's record.">
      <form onSubmit={submit} className="space-y-3">
        <FormBanner message={banner} />

        <div>
          <label className={labelCls} htmlFor="mark-worker">Employee</label>
          <select
            id="mark-worker"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">Select an employee…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.employeeCode})</option>
            ))}
          </select>
          <FieldError errors={errors} name="workerId" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="mark-date">Date</label>
            <input
              id="mark-date"
              type="date"
              value={date}
              max={canBackdate ? undefined : todayKey()}
              min={canBackdate ? undefined : todayKey()}
              disabled={!canBackdate}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
            {!canBackdate && (
              <p className="mt-1 text-xs text-gray-400 dark:text-(--sa-muted)">Your role can only mark today.</p>
            )}
            <FieldError errors={errors} name="date" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mark-status">Status</label>
            <StatusSelect id="mark-status" value={status} onChange={setStatus} />
            <FieldError errors={errors} name="status" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="mark-in">Check in</label>
            <input id="mark-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="checkIn" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mark-out">Check out</label>
            <input id="mark-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="checkOut" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mark-bs">Break start</label>
            <input id="mark-bs" type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="breakStart" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mark-be">Break end</label>
            <input id="mark-be" type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="breakEnd" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="mark-late-override">
              Late override <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(min)</span>
            </label>
            <input
              id="mark-late-override"
              type="number"
              min={0}
              max={1440}
              value={lateOverride}
              onChange={(e) => setLateOverride(e.target.value)}
              className={inputCls}
              placeholder="Auto"
            />
            <FieldError errors={errors} name="lateOverrideMinutes" />
          </div>
          <div>
            <label className={labelCls} htmlFor="mark-ot-override">
              Overtime override <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(min)</span>
            </label>
            <input
              id="mark-ot-override"
              type="number"
              min={0}
              max={1440}
              value={overtimeOverride}
              onChange={(e) => setOvertimeOverride(e.target.value)}
              className={inputCls}
              placeholder="Auto"
            />
            <FieldError errors={errors} name="overtimeOverrideMinutes" />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="mark-reason">
            Reason <span className="text-red-500">*</span>
          </label>
          <input
            id="mark-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            required
            className={inputCls}
            placeholder="e.g. Biometric device offline — verified with branch register"
          />
          <FieldError errors={errors} name="reason" />
        </div>

        <div>
          <label className={labelCls} htmlFor="mark-notes">Remarks</label>
          <textarea
            id="mark-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            className={cn(inputCls, "h-auto py-2")}
            placeholder="Optional — anything else worth recording"
          />
          <FieldError errors={errors} name="notes" />
        </div>

        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          Working hours, late minutes and overtime are calculated automatically from these times
          and the employee&apos;s rostered shift. Leave the overrides blank unless you are
          deliberately correcting a calculated figure. This entry is recorded as manual, against
          your name, and awaits approval.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? "Saving…" : "Mark attendance"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// EDIT ATTENDANCE
// ============================================================================

export function EditAttendanceDialog({
  row,
  onClose,
  recordBaseEndpoint,
  canApproveOvertime,
  canLock,
}: {
  row: AttendanceRow | null;
  onClose: () => void;
  /** Base PATCH URL for a record id. */
  recordBaseEndpoint: string;
  canApproveOvertime: boolean;
  canLock: boolean;
}) {
  const router = useRouter();
  const open = row !== null;

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const [status, setStatus] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [breakStart, setBreakStart] = React.useState("");
  const [breakEnd, setBreakEnd] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [overtimeApproved, setOvertimeApproved] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [lateOverride, setLateOverride] = React.useState("");
  const [overtimeOverride, setOvertimeOverride] = React.useState("");
  const [approved, setApproved] = React.useState(false);

  // Re-seed from the record whenever a DIFFERENT row opens the dialog.
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  if (row && row.id !== loadedId) {
    setLoadedId(row.id);
    setStatus(row.status);
    setCheckIn(timeInputValue(row.checkIn));
    setCheckOut(timeInputValue(row.checkOut));
    setBreakStart(timeInputValue(row.breakStart));
    setBreakEnd(timeInputValue(row.breakEnd));
    setNotes(row.notes ?? "");
    setOvertimeApproved(row.overtimeApproved);
    setIsLocked(row.isLocked);
    setReason(row.manualReason ?? "");
    setLateOverride(row.lateOverrideMinutes === null ? "" : String(row.lateOverrideMinutes));
    setOvertimeOverride(
      row.overtimeOverrideMinutes === null ? "" : String(row.overtimeOverrideMinutes)
    );
    setApproved(row.approvedAt !== null);
    setBanner(null);
    setErrors({});
  } else if (!row && loadedId !== null) {
    setLoadedId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !row) return;

    setBusy(true);
    setBanner(null);
    setErrors({});

    const toOverride = (v: string) => (v.trim() === "" ? null : Number(v));

    const result = await submitJson(`${recordBaseEndpoint}/${row.id}`, "PATCH", {
      status,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      notes: notes.trim() || null,
      lateOverrideMinutes: toOverride(lateOverride),
      overtimeOverrideMinutes: toOverride(overtimeOverride),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      // Only send the privileged fields the caller may actually set — sending them
      // unconditionally would 403 an edit that never intended to change them.
      ...(canApproveOvertime ? { overtimeApproved } : {}),
      ...(canLock ? { isLocked } : {}),
      // Approval only applies to a manual row, and only for a role that may grant it.
      ...(canApproveOvertime && row.isManual ? { approved } : {}),
    });

    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit attendance"
      subtitle={row ? `${workerName(row.worker)} · ${formatDate(row.date)}` : undefined}
    >
      {row && (
        <form onSubmit={submit} className="space-y-3">
          <FormBanner message={banner} />

          {row.isLocked && !canLock && (
            <p className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              This record is locked for payroll. Only a Super Admin or Owner can change it.
            </p>
          )}

          <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
            <span className="font-medium text-gray-700 dark:text-(--sa-text)">{row.branch.name}</span>
            {row.shift ? ` · ${row.shift.name} (${row.shift.startTime}–${row.shift.endTime})` : " · No shift assigned"}
          </div>

          <div>
            <label className={labelCls} htmlFor="edit-status">Status</label>
            <StatusSelect id="edit-status" value={status} onChange={setStatus} allowAuto={false} />
            <FieldError errors={errors} name="status" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="edit-in">Check in</label>
              <input id="edit-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
              <FieldError errors={errors} name="checkIn" />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-out">Check out</label>
              <input id="edit-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
              <FieldError errors={errors} name="checkOut" />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-bs">Break start</label>
              <input id="edit-bs" type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className={inputCls} />
              <FieldError errors={errors} name="breakStart" />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-be">Break end</label>
              <input id="edit-be" type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className={inputCls} />
              <FieldError errors={errors} name="breakEnd" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="edit-late-override">
                Late override <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(min)</span>
              </label>
              <input
                id="edit-late-override"
                type="number"
                min={0}
                max={1440}
                value={lateOverride}
                onChange={(e) => setLateOverride(e.target.value)}
                className={inputCls}
                placeholder="Auto"
              />
              <FieldError errors={errors} name="lateOverrideMinutes" />
            </div>
            <div>
              <label className={labelCls} htmlFor="edit-ot-override">
                Overtime override <span className="font-normal text-gray-400 dark:text-(--sa-muted)">(min)</span>
              </label>
              <input
                id="edit-ot-override"
                type="number"
                min={0}
                max={1440}
                value={overtimeOverride}
                onChange={(e) => setOvertimeOverride(e.target.value)}
                className={inputCls}
                placeholder="Auto"
              />
              <FieldError errors={errors} name="overtimeOverrideMinutes" />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="edit-reason">
              Reason for manual change
            </label>
            <input
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              className={inputCls}
              placeholder="Why is this record being changed by hand?"
            />
            <FieldError errors={errors} name="reason" />
          </div>

          <div>
            <label className={labelCls} htmlFor="edit-notes">Remarks</label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className={cn(inputCls, "h-auto py-2")}
            />
            <FieldError errors={errors} name="notes" />
          </div>

          {(canApproveOvertime || canLock) && (
            <div className="space-y-2 rounded border border-gray-100 px-3 py-2.5 dark:border-(--sa-border)">
              {canApproveOvertime && row.isManual && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-(--sa-text-2)">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                    className="size-3.5 rounded border-gray-300"
                  />
                  Approve this manual entry
                  <span className="text-gray-400 dark:text-(--sa-muted)">
                    ({row.approvedAt ? "currently approved" : "currently pending"})
                  </span>
                </label>
              )}
              {canApproveOvertime && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-(--sa-text-2)">
                  <input
                    type="checkbox"
                    checked={overtimeApproved}
                    onChange={(e) => setOvertimeApproved(e.target.checked)}
                    className="size-3.5 rounded border-gray-300"
                  />
                  Approve overtime
                  <span className="text-gray-400 dark:text-(--sa-muted)">
                    ({row.overtimeMinutes} min claimed)
                  </span>
                </label>
              )}
              {canLock && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-(--sa-text-2)">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)}
                    className="size-3.5 rounded border-gray-300"
                  />
                  Lock for payroll
                  <span className="text-gray-400 dark:text-(--sa-muted)">
                    (blocks all further edits below Owner level)
                  </span>
                </label>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
            Saving recalculates working hours, late minutes and overtime from these times, unless
            you set an override above. Changing any figure marks the record as a manual entry and
            returns it to pending approval.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ============================================================================
// DELETE
// ============================================================================

export function DeleteAttendanceDialog({
  row,
  onClose,
  recordBaseEndpoint,
}: {
  row: AttendanceRow | null;
  onClose: () => void;
  recordBaseEndpoint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);

  // Clear a stale failure when a DIFFERENT record opens the dialog (render-phase,
  // for the same reason as the mark dialog above).
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (row && row.id !== shownId) {
    setShownId(row.id);
    setBanner(null);
  } else if (!row && shownId !== null) {
    setShownId(null);
  }

  async function confirm() {
    if (busy || !row) return;
    setBusy(true);
    setBanner(null);

    const result = await submitJson(`${recordBaseEndpoint}/${row.id}`, "DELETE");
    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={row !== null} onClose={onClose} title="Delete attendance record">
      {row && (
        <div className="space-y-4">
          <FormBanner message={banner} />

          <p className="text-sm text-gray-600 dark:text-(--sa-text-2)">
            Permanently delete the record for{" "}
            <span className="font-medium text-gray-900 dark:text-(--sa-text)">{workerName(row.worker)}</span>{" "}
            on <span className="font-medium text-gray-900 dark:text-(--sa-text)">{formatDate(row.date)}</span>?
          </p>

          <dl className="grid grid-cols-2 gap-2 rounded border border-gray-100 px-3 py-2.5 text-xs dark:border-(--sa-border)">
            <div><dt className="text-gray-400 dark:text-(--sa-muted)">Check in</dt><dd className="text-gray-700 dark:text-(--sa-text)">{formatTime(row.checkIn)}</dd></div>
            <div><dt className="text-gray-400 dark:text-(--sa-muted)">Check out</dt><dd className="text-gray-700 dark:text-(--sa-text)">{formatTime(row.checkOut)}</dd></div>
            <div><dt className="text-gray-400 dark:text-(--sa-muted)">Status</dt><dd className="text-gray-700 dark:text-(--sa-text)">{statusLabel(row.status)}</dd></div>
            <div><dt className="text-gray-400 dark:text-(--sa-muted)">Working</dt><dd className="text-gray-700 dark:text-(--sa-text)">{row.workingMinutes} min</dd></div>
          </dl>

          <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
            This cannot be undone. The deletion is recorded in the audit log.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="button" onClick={confirm} disabled={busy} className={btnDanger}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {busy ? "Deleting…" : "Delete record"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// BULK
// ============================================================================

export function BulkAttendanceDialog({
  open,
  onClose,
  bulkEndpoint,
  workers,
}: {
  open: boolean;
  onClose: () => void;
  bulkEndpoint: string;
  workers: WorkerOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [okMessage, setOkMessage] = React.useState<string | null>(null);

  const [date, setDate] = React.useState(todayKey());
  const [status, setStatus] = React.useState<AttendanceStatus>("PRESENT");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState("");

  // Render-phase reset on open, as in the mark dialog above.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(todayKey());
      setStatus("PRESENT");
      setCheckIn("");
      setCheckOut("");
      setNotes("");
      setReason("");
      setSelected(new Set());
      setFilter("");
      setBanner(null);
      setOkMessage(null);
      setErrors({});
    }
  }

  const visible = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(needle) ||
        w.employeeCode.toLowerCase().includes(needle)
    );
  }, [workers, filter]);

  const allVisibleSelected = visible.length > 0 && visible.every((w) => selected.has(w.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((w) => next.delete(w.id));
      else visible.forEach((w) => next.add(w.id));
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (selected.size === 0) {
      setBanner("Select at least one employee.");
      return;
    }
    if (reason.trim().length < 3) {
      setErrors({ reason: ["A reason is required for a bulk entry"] });
      return;
    }

    setBusy(true);
    setBanner(null);
    setOkMessage(null);
    setErrors({});

    const result = await submitJson(bulkEndpoint, "POST", {
      date,
      status,
      reason: reason.trim(),
      notes: notes.trim() || null,
      entries: [...selected].map((workerId) => ({
        workerId,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
      })),
    });

    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    // The server reports how many were skipped for being payroll-locked. Surface
    // that instead of closing on a partial success the user never sees.
    setOkMessage(result.message);
    router.refresh();
    if (!result.message.includes("skipped")) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Bulk mark attendance"
      subtitle="Apply one status to many employees for a single date."
    >
      <form onSubmit={submit} className="space-y-3">
        <FormBanner message={banner} />
        {okMessage && (
          <p className="mb-3 rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {okMessage}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls} htmlFor="bulk-date">Date</label>
            <input id="bulk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <FieldError errors={errors} name="date" />
          </div>
          <div>
            <label className={labelCls} htmlFor="bulk-status">Status</label>
            <select
              id="bulk-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              className={inputCls}
            >
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="bulk-in">Check in</label>
            <input id="bulk-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="bulk-out">Check out</label>
            <input id="bulk-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
          </div>
        </div>
        <FieldError errors={errors} name="entries" />

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className={cn(labelCls, "mb-0")} htmlFor="bulk-filter">
              Employees <span className="text-gray-400">({selected.size} selected)</span>
            </label>
            <button type="button" onClick={toggleAllVisible} className="text-xs font-medium text-gray-600 underline-offset-2 hover:underline dark:text-(--sa-text-2)">
              {allVisibleSelected ? "Clear visible" : "Select visible"}
            </button>
          </div>

          <input
            id="bulk-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter employees…"
            className={cn(inputCls, "mb-2")}
          />

          <div className="max-h-56 overflow-y-auto rounded border border-gray-200 dark:border-(--sa-border)">
            {visible.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No employees match.</p>
            ) : (
              visible.map((w) => (
                <label
                  key={w.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm last:border-0 hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(w.id)}
                    onChange={() => toggle(w.id)}
                    className="size-3.5 rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-(--sa-text)">{w.name}</span>
                  <span className="ml-auto font-mono text-xs text-gray-400 dark:text-(--sa-muted)">{w.employeeCode}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="bulk-reason">
            Reason <span className="text-red-500">*</span>
          </label>
          <input
            id="bulk-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            required
            className={inputCls}
            placeholder="e.g. Branch closed for maintenance — marked from the duty register"
          />
          <FieldError errors={errors} name="reason" />
        </div>

        <div>
          <label className={labelCls} htmlFor="bulk-notes">Remarks</label>
          <input
            id="bulk-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className={inputCls}
            placeholder="Applied to every selected employee"
          />
        </div>

        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          Every row created here is recorded as a manual entry against your name and awaits approval.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Close</button>
          <button type="submit" disabled={busy || selected.size === 0} className={btnPrimary}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? "Marking…" : `Mark ${selected.size || ""} employee${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
