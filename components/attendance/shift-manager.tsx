"use client";

// ============================================================================
// MODULE : Shift Management — CRUD workspace
//
// Create, edit, deactivate and delete the shift templates the whole roster and the
// attendance engine depend on. Before this existed the `shifts` table had no write
// path at all, which made worker-shift assignment impossible and left late minutes
// with nothing to be measured against.
//
// DELETE vs DEACTIVATE is surfaced honestly. A shift that has been used carries
// history — attendance rows cite it as the roster their late and overtime minutes
// were computed from — so the API refuses to delete it and the UI offers
// Deactivate instead, explaining why rather than showing a foreign-key error.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge, Card, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { AttendanceEmpty } from "@/components/attendance/attendance-ui";
import {
  formatWorkingDays,
  WEEKDAY_LABELS,
  type ShiftRow,
} from "@/components/attendance/types";

type Envelope = { success: boolean; message: string; errors?: Record<string, string[]> };

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-800 outline-none transition " +
  "focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";

const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white " +
  "transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100";

const btnGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 " +
  "transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)";

const btnDanger =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded bg-red-600 px-4 text-sm font-medium text-white " +
  "transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-60";

type FormState = {
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  workingDays: number[];
  graceMinutes: string;
  isActive: boolean;
};

const BLANK: FormState = {
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "",
  breakEnd: "",
  workingDays: [1, 2, 3, 4, 5],
  graceMinutes: "10",
  isActive: true,
};

function toForm(shift: ShiftRow): FormState {
  return {
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakStart: shift.breakStart ?? "",
    breakEnd: shift.breakEnd ?? "",
    workingDays: shift.workingDays,
    graceMinutes: String(shift.graceMinutes),
    isActive: shift.isActive,
  };
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
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
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40 dark:border-(--sa-border) dark:bg-(--sa-surface)"
    >
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5 dark:border-(--sa-border)">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{title}</h2>
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

export function ShiftManager({
  shifts,
  shiftsEndpoint,
  canManage,
}: {
  shifts: ShiftRow[];
  /**
   * Collection URL. The per-shift URL is derived from it rather than taken as a
   * second `(id) => string` prop: this is a client component, and a function
   * cannot cross the server/client boundary — React refuses to serialise it.
   */
  shiftsEndpoint: string;
  /** False for a BRANCH_ADMIN, who may read the catalogue but not author it. */
  canManage: boolean;
}) {
  const router = useRouter();

  const shiftEndpoint = React.useCallback(
    (id: string) => `${shiftsEndpoint}/${id}`,
    [shiftsEndpoint]
  );

  const [editing, setEditing] = React.useState<ShiftRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ShiftRow | null>(null);

  const [form, setForm] = React.useState<FormState>(BLANK);
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const formOpen = creating || editing !== null;

  function openCreate() {
    setForm(BLANK);
    setErrors({});
    setBanner(null);
    setEditing(null);
    setCreating(true);
  }

  function openEdit(shift: ShiftRow) {
    setForm(toForm(shift));
    setErrors({});
    setBanner(null);
    setCreating(false);
    setEditing(shift);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const envelope = (await res.json().catch(() => null)) as Envelope | null;
    return {
      ok: res.ok && Boolean(envelope?.success),
      message: envelope?.message ?? "Request failed",
      errors: envelope?.errors ?? {},
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setBanner(null);
    setErrors({});

    const payload = {
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      breakStart: form.breakStart || null,
      breakEnd: form.breakEnd || null,
      workingDays: form.workingDays,
      graceMinutes: Number(form.graceMinutes) || 0,
      isActive: form.isActive,
    };

    const result = editing
      ? await send(shiftEndpoint(editing.id), "PATCH", payload)
      : await send(shiftsEndpoint, "POST", payload);

    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    router.refresh();
    closeForm();
  }

  async function toggleActive(shift: ShiftRow) {
    if (busy) return;
    setBusy(true);
    const result = await send(shiftEndpoint(shift.id), "PATCH", {
      ...toForm(shift),
      breakStart: shift.breakStart || null,
      breakEnd: shift.breakEnd || null,
      graceMinutes: shift.graceMinutes,
      isActive: !shift.isActive,
    });
    setBusy(false);
    if (result.ok) router.refresh();
    else setBanner(result.message);
  }

  async function confirmDelete() {
    if (busy || !deleting) return;
    setBusy(true);
    setBanner(null);
    const result = await send(shiftEndpoint(deleting.id), "DELETE");
    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      return;
    }

    router.refresh();
    setDeleting(null);
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }));
  }

  return (
    <>
      {banner && !formOpen && !deleting && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {banner}
        </p>
      )}

      {canManage && (
        <div className="flex justify-end">
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus className="size-3.5" aria-hidden="true" /> New shift
          </button>
        </div>
      )}

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Shift</TH>
              <TH>Hours</TH>
              <TH>Break</TH>
              <TH>Working days</TH>
              <TH>Grace</TH>
              <TH>Assigned</TH>
              <TH>Status</TH>
              {canManage && <TH>Actions</TH>}
            </tr>
          </THead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7}>
                  <AttendanceEmpty
                    icon={Clock}
                    title="No shifts defined yet"
                    hint={
                      canManage
                        ? "Create a shift to roster employees and let attendance calculate late minutes and overtime."
                        : "A Super Admin or Owner needs to create shift templates before they can be assigned."
                    }
                  />
                </td>
              </tr>
            ) : (
              shifts.map((shift) => (
                <TR key={shift.id}>
                  <TD className="text-sm text-gray-800 dark:text-(--sa-text)">{shift.name}</TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {shift.startTime}–{shift.endTime}
                    {shift.endTime <= shift.startTime && (
                      <span className="ml-1 text-[10px] text-gray-400">(overnight)</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {shift.breakStart && shift.breakEnd ? `${shift.breakStart}–${shift.breakEnd}` : "—"}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-(--sa-text-2)">
                    {formatWorkingDays(shift.workingDays)}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {shift.graceMinutes} min
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                    {shift._count.workerShifts} worker{shift._count.workerShifts === 1 ? "" : "s"}
                  </TD>
                  <TD>
                    <Badge tone={shift.isActive ? "success" : "neutral"}>
                      {shift.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  {canManage && (
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(shift)}
                          aria-label={`Edit ${shift.name}`}
                          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(shift)}
                          aria-label={`${shift.isActive ? "Deactivate" : "Activate"} ${shift.name}`}
                          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
                        >
                          <Power className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBanner(null); setDeleting(shift); }}
                          aria-label={`Delete ${shift.name}`}
                          className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={formOpen} onClose={closeForm} title={editing ? "Edit shift" : "New shift"}>
        <form onSubmit={submit} className="space-y-3">
          {banner && (
            <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {banner}
            </p>
          )}

          <div>
            <label className={labelCls} htmlFor="shift-name">Name</label>
            <input
              id="shift-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={inputCls}
              placeholder="Morning"
              required
              maxLength={60}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.join(" ")}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="shift-start">Start time</label>
              <input id="shift-start" type="time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} className={inputCls} required />
              {errors.startTime && <p className="mt-1 text-xs text-red-600">{errors.startTime.join(" ")}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="shift-end">End time</label>
              <input id="shift-end" type="time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} className={inputCls} required />
              {errors.endTime && <p className="mt-1 text-xs text-red-600">{errors.endTime.join(" ")}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="shift-bs">Break start</label>
              <input id="shift-bs" type="time" value={form.breakStart} onChange={(e) => setForm((p) => ({ ...p, breakStart: e.target.value }))} className={inputCls} />
              {errors.breakStart && <p className="mt-1 text-xs text-red-600">{errors.breakStart.join(" ")}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="shift-be">Break end</label>
              <input id="shift-be" type="time" value={form.breakEnd} onChange={(e) => setForm((p) => ({ ...p, breakEnd: e.target.value }))} className={inputCls} />
              {errors.breakEnd && <p className="mt-1 text-xs text-red-600">{errors.breakEnd.join(" ")}</p>}
            </div>
          </div>

          <div>
            <span className={labelCls}>Working days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const on = form.workingDays.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-8 w-12 rounded border text-xs font-medium transition",
                      on
                        ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {errors.workingDays && <p className="mt-1 text-xs text-red-600">{errors.workingDays.join(" ")}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="shift-grace">Grace period (minutes)</label>
              <input
                id="shift-grace"
                type="number"
                min={0}
                max={120}
                value={form.graceMinutes}
                onChange={(e) => setForm((p) => ({ ...p, graceMinutes: e.target.value }))}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-(--sa-muted)">
                Arrivals within this window are not counted late.
              </p>
              {errors.graceMinutes && <p className="mt-1 text-xs text-red-600">{errors.graceMinutes.join(" ")}</p>}
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-(--sa-text-2)">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="size-3.5 rounded border-gray-300"
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeForm} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {busy ? "Saving…" : editing ? "Save changes" : "Create shift"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete shift">
        {deleting && (
          <div className="space-y-4">
            {banner && (
              <p role="alert" className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                {banner}
              </p>
            )}

            <p className="text-sm text-gray-600 dark:text-(--sa-text-2)">
              Delete <span className="font-medium text-gray-900 dark:text-(--sa-text)">{deleting.name}</span>?
            </p>

            {(deleting._count.workerShifts > 0 || deleting._count.attendances > 0) && (
              <p className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
                This shift is used by {deleting._count.workerShifts} assignment(s) and{" "}
                {deleting._count.attendances} attendance record(s). Deleting will be refused — deactivate it
                instead to remove it from every picker while keeping its history intact.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className={btnGhost}>Cancel</button>
              <button
                type="button"
                onClick={() => void toggleActive(deleting).then(() => setDeleting(null))}
                className={btnGhost}
              >
                <Power className="size-3.5" aria-hidden="true" /> Deactivate
              </button>
              <button type="button" onClick={confirmDelete} disabled={busy} className={btnDanger}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
