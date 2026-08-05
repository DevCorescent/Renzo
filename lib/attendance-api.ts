// ============================================================================
// MODULE : Attendance — shared route handlers
//
// Every attendance endpoint in the product is a thin wrapper over this file.
//
// /api/v1/admin/attendance, /api/v1/branch-admin/attendance and
// /api/v1/reception/attendance are three DOORS onto ONE implementation — they
// differ only in which roles they admit and which capabilities those roles carry.
// Copy-pasting the list handler three times is how a branch admin eventually ends
// up able to read another branch: the fix lands in one copy and not the others.
//
// AUTHORIZATION IS LAYERED, and every layer is applied here:
//   1. requireAuth()            — is your ROLE allowed on this endpoint?
//   2. requireBranchScope()     — which BRANCH may you touch?
//   3. capabilitiesFor()        — may your role delete / edit / approve overtime?
//   4. denyIfWorkerOutOfScope() — is this specific worker inside your branch?
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "@/lib/attendance";

import prisma from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import {
  requireBranchScope,
  denyIfWorkerOutOfScope,
  workerBranchWhere,
  type BranchScope,
} from "@/lib/branch-scope";
import { created, err, ok, paginated, parsePagination } from "@/lib/response";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import type { AuthUser, UserType } from "@/types/api";
import {
  ATTENDANCE_STATUSES,
  anchorLocalTime,
  attendanceDateKey,
  capabilitiesFor,
  formatDateKey,
  parseDateKey,
  summarizeAttendance,
  type AttendanceCapability,
} from "@/lib/attendance";
import {
  ATTENDANCE_METRIC_SELECT,
  ATTENDANCE_SELECT,
  applyOverrides,
  attendanceOrderBy,
  buildAttendanceWhere,
  buildRecordFields,
  checkWorkerEligibility,
  loadAttendanceContext,
  loadAttendanceContexts,
  monthBounds,
  parseAttendanceFilters,
  resolveMarkedBy,
  resolveWorkerBranchId,
  type AttendanceRecord,
} from "@/lib/attendance-service";

const MODULE = "ATTENDANCE";

// ============================================================================
// CAPABILITIES
//
// The table itself lives in lib/attendance.ts so the admin PAGES can read it too —
// see that file's header. Re-exported here because every route-layer consumer
// reaches for it through this module.
// ============================================================================

export { capabilitiesFor };
export type { AttendanceCapability };

// ============================================================================
// SCHEMAS
// ============================================================================

const StatusEnum = z.enum(ATTENDANCE_STATUSES);

/** "HH:mm" (anchored to the record's date) or a full ISO instant. */
const TimeString = z
  .string()
  .trim()
  .refine(
    (v) => /^\d{1,2}:\d{2}$/.test(v) || !Number.isNaN(new Date(v).getTime()),
    "Must be HH:mm or an ISO date-time"
  );

const NullableTime = TimeString.nullable().optional();

const DateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

/**
 * Why a human authored this row. Required on every manual entry — a manual
 * attendance record without a stated reason is exactly the kind of unaccountable
 * edit the audit trail exists to prevent.
 */
const ManualReason = z
  .string()
  .trim()
  .min(3, "Give a reason of at least 3 characters")
  .max(300);

/** A supervisor correction to a derived figure. Null clears it back to the engine's value. */
const OverrideMinutes = z
  .number()
  .int("Must be a whole number of minutes")
  .min(0, "Cannot be negative")
  .max(24 * 60, "Cannot exceed 24 hours")
  .nullable()
  .optional();

const MarkSchema = z.object({
  workerId: z.string().trim().min(1, "workerId is required"),
  branchId: z.string().trim().min(1).optional(),
  date: DateKey.optional(),
  status: StatusEnum.optional(),
  checkIn: NullableTime,
  checkOut: NullableTime,
  breakStart: NullableTime,
  breakEnd: NullableTime,
  notes: z.string().trim().max(500).nullable().optional(),
  /** Marks this write as a manual entry; `reason` then becomes mandatory. */
  isManual: z.boolean().optional(),
  reason: ManualReason.optional(),
  lateOverrideMinutes: OverrideMinutes,
  overtimeOverrideMinutes: OverrideMinutes,
});

const CLOCK_ACTIONS = ["CHECK_IN", "CHECK_OUT", "BREAK_START", "BREAK_END"] as const;
export type ClockAction = (typeof CLOCK_ACTIONS)[number];

const ClockSchema = z.object({
  workerId: z.string().trim().min(1).optional(),
  action: z.enum(CLOCK_ACTIONS),
  at: TimeString.optional(),
});

const PatchSchema = z.object({
  status: StatusEnum.optional(),
  checkIn: NullableTime,
  checkOut: NullableTime,
  breakStart: NullableTime,
  breakEnd: NullableTime,
  notes: z.string().trim().max(500).nullable().optional(),
  overtimeApproved: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  reason: ManualReason.optional(),
  lateOverrideMinutes: OverrideMinutes,
  overtimeOverrideMinutes: OverrideMinutes,
  /** true approves this manual entry, false sends it back to pending. */
  approved: z.boolean().optional(),
});

const BulkSchema = z.object({
  date: DateKey.optional(),
  status: StatusEnum.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  // Bulk marking is manual BY DEFINITION — nobody clocks 40 people in at once —
  // so the reason is required here rather than optional.
  reason: ManualReason,
  entries: z
    .array(
      z.object({
        workerId: z.string().trim().min(1),
        status: StatusEnum.optional(),
        checkIn: NullableTime,
        checkOut: NullableTime,
        notes: z.string().trim().max(500).nullable().optional(),
      })
    )
    .min(1, "At least one entry is required")
    .max(200, "At most 200 entries per request"),
});

// ============================================================================
// TIME INPUT
// ============================================================================

/**
 * Resolve a client time value against the record's date.
 *
 * `undefined` means "field not sent — leave it alone"; `null` means "clear it".
 * The distinction matters: a PATCH that only changes `notes` must not wipe a
 * check-in, and a PATCH that explicitly sends `checkOut: null` must.
 *
 * A bare "HH:mm" is anchored in salon-local time onto the record's own date, so
 * an admin typing 09:30 gets 09:30 at the salon rather than 09:30 UTC.
 */
function resolveTime(
  value: string | null | undefined,
  dateKey: Date
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return anchorLocalTime(dateKey, trimmed);

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Apply a partial time patch over the currently stored values. */
function mergeTimes(
  current: { checkIn: Date | null; checkOut: Date | null; breakStart: Date | null; breakEnd: Date | null },
  patch: { checkIn?: Date | null; checkOut?: Date | null; breakStart?: Date | null; breakEnd?: Date | null }
) {
  return {
    checkIn: patch.checkIn === undefined ? current.checkIn : patch.checkIn,
    checkOut: patch.checkOut === undefined ? current.checkOut : patch.checkOut,
    breakStart: patch.breakStart === undefined ? current.breakStart : patch.breakStart,
    breakEnd: patch.breakEnd === undefined ? current.breakEnd : patch.breakEnd,
  };
}

// ============================================================================
// VALIDATION — the ordering invariants the database cannot express
// ============================================================================

type Times = {
  checkIn: Date | null;
  checkOut: Date | null;
  breakStart: Date | null;
  breakEnd: Date | null;
};

/**
 * Enforce that four timestamps describe a coherent day.
 *
 * Postgres cannot express "checkOut must follow checkIn" across nullable columns,
 * so it is enforced here — on EVERY write path, admin edits included. Without it
 * an inverted pair silently yields zero working minutes and a payroll figure that
 * is wrong but not obviously wrong.
 */
function validateTimes(times: Times): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};
  const { checkIn, checkOut, breakStart, breakEnd } = times;

  if (checkOut && !checkIn) {
    errors.checkOut = ["Cannot record a check-out without a check-in"];
  }
  if (checkIn && checkOut && checkOut.getTime() <= checkIn.getTime()) {
    errors.checkOut = ["Check-out must be after check-in"];
  }

  if (breakStart && !checkIn) {
    errors.breakStart = ["Cannot start a break before checking in"];
  }
  if (checkIn && breakStart && breakStart.getTime() < checkIn.getTime()) {
    errors.breakStart = ["Break cannot start before check-in"];
  }
  if (breakEnd && !breakStart) {
    errors.breakEnd = ["Cannot end a break that never started"];
  }
  if (breakStart && breakEnd && breakEnd.getTime() <= breakStart.getTime()) {
    errors.breakEnd = ["Break end must be after break start"];
  }
  if (checkOut && breakEnd && breakEnd.getTime() > checkOut.getTime()) {
    errors.breakEnd = ["Break cannot end after check-out"];
  }
  if (checkOut && breakStart && breakStart.getTime() > checkOut.getTime()) {
    errors.breakStart = ["Break cannot start after check-out"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ============================================================================
// SHARED PRELUDE
// ============================================================================

type Guarded =
  | { user: AuthUser; scope: BranchScope; caps: AttendanceCapability; error: null }
  | { user: null; scope: null; caps: null; error: ReturnType<typeof err> };

/** requireAuth + requireBranchScope + capabilities, in one call. */
async function guard(
  req: NextRequest,
  roles: UserType[],
  withUrl = false
): Promise<Guarded> {
  const { user, error } = await requireAuth(req, ...roles);
  if (error) return { user: null, scope: null, caps: null, error };

  const { scope, error: scopeError } = requireBranchScope(
    user,
    withUrl ? new URL(req.url) : undefined
  );
  if (scopeError) return { user: null, scope: null, caps: null, error: scopeError };

  return { user, scope, caps: capabilitiesFor(user.userType), error: null };
}

/**
 * Attach the display names behind every user id on a page of records.
 *
 * One batched lookup covers all three references (who marked it, who raised the
 * manual entry, who approved it) — resolving them separately would be three
 * round-trips per page for names that overwhelmingly repeat.
 */
export async function withMarkedByNames(records: AttendanceRecord[]) {
  const labels = await resolveMarkedBy(prisma, [
    ...records.map((r) => r.markedBy),
    ...records.map((r) => r.manualCreatedBy),
    ...records.map((r) => r.approvedBy),
  ]);

  const nameOf = (id: string | null) => (id ? labels.get(id)?.name ?? null : null);

  return records.map((record) => ({
    ...record,
    markedByName: nameOf(record.markedBy),
    manualCreatedByName: nameOf(record.manualCreatedBy),
    approvedByName: nameOf(record.approvedBy),
  }));
}

// ============================================================================
// LIST
// ============================================================================

/** GET — paginated, filtered, sorted, searched, branch-scoped attendance. */
export async function listAttendance(req: NextRequest, roles: UserType[]) {
  const { scope, error } = await guard(req, roles, true);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const filters = parseAttendanceFilters(url);
    const where = buildAttendanceWhere(filters, scope);

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: attendanceOrderBy(filters),
        select: ATTENDANCE_SELECT,
      }),
      prisma.attendance.count({ where }),
    ]);

    return paginated(await withMarkedByNames(records), total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// DETAIL
// ============================================================================

export async function getAttendance(req: NextRequest, id: string, roles: UserType[]) {
  const { scope, error } = await guard(req, roles);
  if (error) return error;

  try {
    const record = await prisma.attendance.findUnique({
      where: { id },
      select: ATTENDANCE_SELECT,
    });
    if (!record) return err("Attendance record not found", 404);

    // 404 rather than 403 for an out-of-branch record, matching the convention in
    // branch-scope.ts: a 403 would confirm the id exists in someone else's branch.
    if (!scope.isGlobal && record.branch.id !== scope.branchId) {
      return err("Attendance record not found", 404);
    }

    const [enriched] = await withMarkedByNames([record]);
    return ok(enriched);
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// MARK — manual create/update, and clock actions
// ============================================================================

/**
 * POST — one endpoint, two shapes.
 *
 *   { action: "CHECK_IN", workerId }              → clock action (front desk)
 *   { workerId, date, status, checkIn, checkOut } → manual/edit mark (admin)
 *
 * Both converge on the same upsert and the same engine, so a receptionist's
 * check-in and an admin's manual entry produce identical, comparable records.
 */
export async function markAttendance(req: NextRequest, roles: UserType[]) {
  const { user, scope, caps, error } = await guard(req, roles);
  if (error) return error;

  if (!caps.canMark) {
    return err("Forbidden — your role cannot mark attendance", 403);
  }

  const body = await readJson(req);
  const isClock =
    typeof body === "object" && body !== null && "action" in (body as Record<string, unknown>);

  return isClock
    ? clockAction(req, body, user, scope, caps)
    : manualMark(req, body, user, scope, caps);
}

/**
 * The clock state machine and its write — shared by BOTH doors.
 *
 * The front desk clocking a stylist in and that stylist clocking themselves in
 * must produce byte-identical records; they differ only in who is recorded as
 * having done it. So the transition rules, the validation, the engine call and
 * the upsert all live here once, and the two callers supply only identity.
 *
 * `markedBy: null` marks a self-service action — the export and the table render
 * that as "Self" rather than naming the worker as their own supervisor.
 */
async function applyClock(params: {
  workerId: string;
  action: ClockAction;
  at: string | undefined;
  actor: AuthUser;
  /** Null for self-service; the acting user's id when someone clocks another person. */
  markedBy: string | null;
  canOverrideLock: boolean;
  preferredBranchId: string | null;
}) {
  const { workerId, action, actor, markedBy, canOverrideLock, preferredBranchId } = params;

  const date = attendanceDateKey();
  const stamp = params.at ? resolveTime(params.at, date) ?? new Date() : new Date();

  const branchId = await resolveWorkerBranchId(prisma, workerId, preferredBranchId);
  if (!branchId) return err("Worker is not assigned to a branch", 409);

  const existing = await prisma.attendance.findUnique({
    where: { workerId_date: { workerId, date } },
    select: {
      id: true, checkIn: true, checkOut: true, breakStart: true, breakEnd: true,
      isLocked: true,
    },
  });

  if (existing?.isLocked && !canOverrideLock) {
    return err("This attendance record is locked for payroll and cannot be changed", 409);
  }

  const conflict = clockConflict(action, existing);
  if (conflict) return err(conflict, 409);

  const patch =
    action === "CHECK_IN" ? { checkIn: stamp }
    : action === "CHECK_OUT" ? { checkOut: stamp }
    : action === "BREAK_START" ? { breakStart: stamp }
    : { breakEnd: stamp };

  const times = mergeTimes(
    {
      checkIn: existing?.checkIn ?? null,
      checkOut: existing?.checkOut ?? null,
      breakStart: existing?.breakStart ?? null,
      breakEnd: existing?.breakEnd ?? null,
    },
    patch
  );

  const timeErrors = validateTimes(times);
  if (timeErrors) return err("Validation failed", 422, timeErrors);

  const context = await loadAttendanceContext(prisma, { workerId, branchId, date });
  const fields = buildRecordFields(date, times, context);

  const stamped = { markedBy };

  const record = await prisma.attendance.upsert({
    where: { workerId_date: { workerId, date } },
    update: { ...times, ...fields, ...stamped },
    create: { workerId, branchId, date, ...times, ...fields, ...stamped },
    select: ATTENDANCE_SELECT,
  });

  await writeAudit(actor, {
    action: existing ? "UPDATE" : "CREATE",
    module: MODULE,
    refId: record.id,
    refType: "Attendance",
    newValue: { action, workerId, date: formatDateKey(date), at: stamp.toISOString() },
  });

  const [enriched] = await withMarkedByNames([record]);
  return created(enriched, `Attendance ${action.replace("_", " ").toLowerCase()} recorded`);
}

async function clockAction(
  req: NextRequest,
  body: unknown,
  user: AuthUser,
  scope: BranchScope,
  caps: AttendanceCapability
) {
  const parsed = validate(ClockSchema, body);
  if (parsed.error) return parsed.error;

  const workerId = parsed.data.workerId;
  if (!workerId) {
    return err("Validation failed", 422, { workerId: ["workerId is required"] });
  }

  try {
    const denied = await denyIfWorkerOutOfScope(prisma, workerId, scope);
    if (denied) return denied;

    return await applyClock({
      workerId,
      action: parsed.data.action,
      at: parsed.data.at,
      actor: user,
      markedBy: user.userId,
      canOverrideLock: caps.canOverrideLock,
      preferredBranchId: scope.branchId,
    });
  } catch {
    return err("Internal server error", 500);
  }
}

/** The state machine behind "cannot check in twice". */
function clockConflict(
  action: ClockAction,
  existing: { checkIn: Date | null; checkOut: Date | null; breakStart: Date | null; breakEnd: Date | null } | null
): string | null {
  const checkIn = existing?.checkIn ?? null;
  const checkOut = existing?.checkOut ?? null;
  const breakStart = existing?.breakStart ?? null;
  const breakEnd = existing?.breakEnd ?? null;

  switch (action) {
    case "CHECK_IN":
      if (checkIn) return "Already checked in for today";
      return null;
    case "CHECK_OUT":
      if (!checkIn) return "Cannot check out before checking in";
      if (checkOut) return "Already checked out for today";
      if (breakStart && !breakEnd) return "End the current break before checking out";
      return null;
    case "BREAK_START":
      if (!checkIn) return "Cannot start a break before checking in";
      if (checkOut) return "Cannot start a break after checking out";
      if (breakStart && !breakEnd) return "A break is already in progress";
      if (breakStart && breakEnd) return "Only one break per day is supported";
      return null;
    case "BREAK_END":
      if (!breakStart) return "No break has been started";
      if (breakEnd) return "The break has already ended";
      return null;
  }
}

async function manualMark(
  req: NextRequest,
  body: unknown,
  user: AuthUser,
  scope: BranchScope,
  caps: AttendanceCapability
) {
  const parsed = validate(MarkSchema, body);
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  // A manual entry must say WHY. Enforced here rather than in the schema because
  // `isManual` and `reason` are only co-dependent on this path — the clock door
  // has neither.
  if (input.isManual && !input.reason) {
    return err("Validation failed", 422, {
      reason: ["A reason is required for a manual attendance entry"],
    });
  }

  try {
    const denied = await denyIfWorkerOutOfScope(prisma, input.workerId, scope);
    if (denied) return denied;

    const date = input.date ? parseDateKey(input.date) : attendanceDateKey();
    if (!date) return err("Validation failed", 422, { date: ["Invalid date"] });

    // A date the calendar has not reached cannot have been worked.
    if (formatDateKey(date) > formatDateKey(attendanceDateKey())) {
      return err("Validation failed", 422, {
        date: ["Attendance cannot be recorded for a future date"],
      });
    }

    if (!caps.canBackdate && formatDateKey(date) !== formatDateKey(attendanceDateKey())) {
      return err("Forbidden — your role can only mark attendance for today", 403);
    }

    const eligibility = await checkWorkerEligibility(prisma, input.workerId, date);
    if (!eligibility.ok) {
      return err("Validation failed", 422, { [eligibility.field]: [eligibility.message] });
    }

    const branchId = await resolveWorkerBranchId(
      prisma,
      input.workerId,
      scope.isGlobal ? input.branchId ?? null : scope.branchId
    );
    if (!branchId) return err("Worker is not assigned to a branch", 409);

    const existing = await prisma.attendance.findUnique({
      where: { workerId_date: { workerId: input.workerId, date } },
      select: {
        id: true, checkIn: true, checkOut: true, breakStart: true, breakEnd: true,
        status: true, notes: true, isLocked: true,
        isManual: true, manualReason: true, manualCreatedBy: true, manualCreatedAt: true,
        approvedAt: true, lateOverrideMinutes: true, overtimeOverrideMinutes: true,
      },
    });

    if (existing && !caps.canEdit) {
      return err(
        "Attendance for this worker and date already exists, and your role cannot edit it",
        409
      );
    }
    if (existing?.isLocked && !caps.canOverrideLock) {
      return err("This attendance record is locked for payroll and cannot be changed", 409);
    }

    const times = mergeTimes(
      {
        checkIn: existing?.checkIn ?? null,
        checkOut: existing?.checkOut ?? null,
        breakStart: existing?.breakStart ?? null,
        breakEnd: existing?.breakEnd ?? null,
      },
      {
        checkIn: resolveTime(input.checkIn, date),
        checkOut: resolveTime(input.checkOut, date),
        breakStart: resolveTime(input.breakStart, date),
        breakEnd: resolveTime(input.breakEnd, date),
      }
    );

    const timeErrors = validateTimes(times);
    if (timeErrors) return err("Validation failed", 422, timeErrors);

    const context = await loadAttendanceContext(prisma, {
      workerId: input.workerId,
      branchId,
      date,
    });
    const derived = buildRecordFields(date, times, context, input.status ?? null);
    const fields = applyOverrides(derived, input, existing);

    const notes = input.notes === undefined ? existing?.notes ?? null : input.notes;

    // Anything written through this door is human-authored. `isManual` therefore
    // defaults to true here and is only false when a caller explicitly says so —
    // the clock door never reaches this function.
    const manual = input.isManual ?? true;
    const now = new Date();

    const manualFields = manual
      ? {
          isManual: true,
          manualReason: input.reason ?? existing?.manualReason ?? null,
          // Authorship is stamped once, on first manual creation, so a later edit
          // does not rewrite who originally raised the entry.
          manualCreatedBy: existing?.manualCreatedBy ?? user.userId,
          manualCreatedAt: existing?.manualCreatedAt ?? now,
          // Editing an approved row revokes its approval: the figures a manager
          // signed off are no longer the figures on the record.
          ...(existing?.approvedAt ? { approvedBy: null, approvedAt: null } : {}),
        }
      : {};

    const record = await prisma.attendance.upsert({
      where: { workerId_date: { workerId: input.workerId, date } },
      update: { ...times, ...fields, ...manualFields, notes, markedBy: user.userId },
      create: {
        workerId: input.workerId,
        branchId,
        date,
        ...times,
        ...fields,
        ...manualFields,
        notes,
        markedBy: user.userId,
      },
      select: ATTENDANCE_SELECT,
    });

    await writeAudit(user, {
      action: existing ? "UPDATE" : "CREATE",
      module: MODULE,
      refId: record.id,
      refType: "Attendance",
      ...(existing ? { oldValue: serialize(existing) } : {}),
      newValue: {
        workerId: input.workerId,
        date: formatDateKey(date),
        ...fields,
        isManual: manual,
        ...(manual && input.reason ? { manualReason: input.reason } : {}),
      },
    });

    return existing
      ? ok((await withMarkedByNames([record]))[0], "Attendance updated")
      : created((await withMarkedByNames([record]))[0], "Attendance marked");
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// PATCH
// ============================================================================

export async function patchAttendance(req: NextRequest, id: string, roles: UserType[]) {
  const { user, scope, caps, error } = await guard(req, roles);
  if (error) return error;

  if (!caps.canEdit) {
    return err("Forbidden — your role cannot edit attendance", 403);
  }

  const parsed = validate(PatchSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const existing = await prisma.attendance.findUnique({
      where: { id },
      select: {
        id: true, workerId: true, branchId: true, date: true,
        checkIn: true, checkOut: true, breakStart: true, breakEnd: true,
        status: true, notes: true, isLocked: true, overtimeApproved: true,
        isManual: true, manualReason: true, manualCreatedBy: true, manualCreatedAt: true,
        approvedBy: true, approvedAt: true,
        lateOverrideMinutes: true, overtimeOverrideMinutes: true,
      },
    });
    if (!existing) return err("Attendance record not found", 404);

    if (!scope.isGlobal && existing.branchId !== scope.branchId) {
      return err("Attendance record not found", 404);
    }

    // An unlock must itself be allowed through, otherwise a locked row could never
    // be reopened: `canOverrideLock` and `canLock` are held by the same roles.
    if (existing.isLocked && !caps.canOverrideLock) {
      return err("This attendance record is locked for payroll and cannot be edited", 409);
    }

    if (input.overtimeApproved !== undefined && !caps.canApproveOvertime) {
      return err("Forbidden — your role cannot approve overtime", 403);
    }
    if (input.isLocked !== undefined && !caps.canLock) {
      return err("Forbidden — your role cannot lock attendance", 403);
    }
    // Approving a manual entry is a supervisory act, so it rides the same
    // capability as approving overtime rather than plain edit rights — otherwise
    // the branch admin who raised the entry could sign off their own work.
    if (input.approved !== undefined && !caps.canApproveOvertime) {
      return err("Forbidden — your role cannot approve manual attendance", 403);
    }
    if (input.approved !== undefined && !existing.isManual) {
      return err("Only a manual attendance entry needs approval", 409);
    }

    const times = mergeTimes(existing, {
      checkIn: resolveTime(input.checkIn, existing.date),
      checkOut: resolveTime(input.checkOut, existing.date),
      breakStart: resolveTime(input.breakStart, existing.date),
      breakEnd: resolveTime(input.breakEnd, existing.date),
    });

    const timeErrors = validateTimes(times);
    if (timeErrors) return err("Validation failed", 422, timeErrors);

    const context = await loadAttendanceContext(prisma, {
      workerId: existing.workerId,
      branchId: existing.branchId,
      date: existing.date,
    });
    const derived = buildRecordFields(existing.date, times, context, input.status ?? null);
    const fields = applyOverrides(derived, input, existing);

    // Does this PATCH change what the record SAYS, as opposed to only its
    // approval/lock state? Approving a row must not revoke its own approval.
    const changesFigures =
      input.status !== undefined ||
      input.checkIn !== undefined ||
      input.checkOut !== undefined ||
      input.breakStart !== undefined ||
      input.breakEnd !== undefined ||
      input.lateOverrideMinutes !== undefined ||
      input.overtimeOverrideMinutes !== undefined;

    const now = new Date();

    const approval =
      input.approved !== undefined
        ? input.approved
          ? { approvedBy: user.userId, approvedAt: now }
          : { approvedBy: null, approvedAt: null }
        : // An edit to an already-approved manual row sends it back to pending: the
          // figures a manager signed off are no longer the figures on the record.
          existing.isManual && existing.approvedAt && changesFigures
          ? { approvedBy: null, approvedAt: null }
          : {};

    // A hand-edited row IS a manual row, whatever created it. Editing an automatic
    // record by hand must not leave it labelled "Automatic" in the report.
    const manual = changesFigures
      ? {
          isManual: true,
          ...(input.reason !== undefined ? { manualReason: input.reason } : {}),
          manualCreatedBy: existing.manualCreatedBy ?? user.userId,
          manualCreatedAt: existing.manualCreatedAt ?? now,
        }
      : input.reason !== undefined
        ? { manualReason: input.reason }
        : {};

    const flags = {
      ...(input.overtimeApproved !== undefined
        ? { overtimeApproved: input.overtimeApproved }
        : {}),
      ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
      ...manual,
      ...approval,
    };

    const record = await prisma.attendance.update({
      where: { id },
      data: {
        ...times,
        ...fields,
        ...flags,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        markedBy: user.userId,
      },
      select: ATTENDANCE_SELECT,
    });

    await writeAudit(user, {
      action: "UPDATE",
      module: MODULE,
      refId: id,
      refType: "Attendance",
      oldValue: serialize(existing),
      newValue: serialize({
        ...times,
        ...fields,
        ...flags,
        notes: input.notes ?? existing.notes,
      }),
    });

    const [enriched] = await withMarkedByNames([record]);
    return ok(enriched, "Attendance updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteAttendance(req: NextRequest, id: string, roles: UserType[]) {
  const { user, scope, caps, error } = await guard(req, roles);
  if (error) return error;

  if (!caps.canDelete) {
    return err("Forbidden — your role cannot delete attendance", 403);
  }

  try {
    const existing = await prisma.attendance.findUnique({
      where: { id },
      select: {
        id: true, workerId: true, branchId: true, date: true, status: true,
        checkIn: true, checkOut: true, workingMinutes: true, isLocked: true,
      },
    });
    if (!existing) return err("Attendance record not found", 404);

    if (!scope.isGlobal && existing.branchId !== scope.branchId) {
      return err("Attendance record not found", 404);
    }

    if (existing.isLocked && !caps.canOverrideLock) {
      return err("This attendance record is locked for payroll and cannot be deleted", 409);
    }

    await prisma.attendance.delete({ where: { id } });

    await writeAudit(user, {
      action: "DELETE",
      module: MODULE,
      refId: id,
      refType: "Attendance",
      oldValue: serialize(existing),
    });

    return ok({ id }, "Attendance deleted");
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// BULK
// ============================================================================

/**
 * POST — mark many workers for one date in a single transaction.
 *
 * The roster/holiday/leave context for every worker is loaded in ONE batch before
 * the transaction opens, so a 60-worker mark is three context queries plus the
 * writes — not 180 queries interleaved with them.
 */
export async function bulkAttendance(req: NextRequest, roles: UserType[]) {
  const { user, scope, caps, error } = await guard(req, roles);
  if (error) return error;

  if (!caps.canBulk) {
    return err("Forbidden — your role cannot bulk-mark attendance", 403);
  }

  const parsed = validate(BulkSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const date = input.date ? parseDateKey(input.date) : attendanceDateKey();
    if (!date) return err("Validation failed", 422, { date: ["Invalid date"] });

    if (formatDateKey(date) > formatDateKey(attendanceDateKey())) {
      return err("Validation failed", 422, {
        date: ["Attendance cannot be recorded for a future date"],
      });
    }

    if (!caps.canBackdate && formatDateKey(date) !== formatDateKey(attendanceDateKey())) {
      return err("Forbidden — your role can only mark attendance for today", 403);
    }

    const workerIds = [...new Set(input.entries.map((e) => e.workerId))];

    // Every target must be a real, active worker inside the caller's branch. One
    // query settles existence AND scope for the whole batch.
    const workers = await prisma.workerProfile.findMany({
      where: { id: { in: workerIds }, ...workerBranchWhere(scope) },
      select: {
        id: true,
        isActive: true,
        joinDate: true,
        branches: {
          where: { isActive: true },
          orderBy: { isPrimary: "desc" },
          select: { branchId: true },
        },
      },
    });

    const workerMap = new Map(workers.map((w) => [w.id, w]));
    const unknown = workerIds.filter((id) => !workerMap.has(id));
    if (unknown.length > 0) {
      return err("Validation failed", 422, {
        entries: [`Unknown or out-of-scope workers: ${unknown.join(", ")}`],
      });
    }

    // Same employment rules the single-mark path applies, checked in memory here
    // because the batch already holds every worker row.
    const dateKey = formatDateKey(date);
    const ineligible = workers
      .filter((w) => !w.isActive || formatDateKey(w.joinDate) > dateKey)
      .map((w) => w.id);
    if (ineligible.length > 0) {
      return err("Validation failed", 422, {
        entries: [
          `Deactivated, or not yet joined on ${dateKey}: ${ineligible.join(", ")}`,
        ],
      });
    }

    const resolved: {
      workerId: string;
      branchId: string;
      status?: AttendanceStatus;
      checkIn: Date | null;
      checkOut: Date | null;
      notes: string | null;
    }[] = [];

    for (const entry of input.entries) {
      const worker = workerMap.get(entry.workerId)!;
      const branchId = scope.isGlobal
        ? worker.branches[0]?.branchId
        : scope.branchId ?? worker.branches[0]?.branchId;

      if (!branchId) {
        return err("Validation failed", 422, {
          entries: [`Worker ${entry.workerId} is not assigned to a branch`],
        });
      }

      const checkIn = resolveTime(entry.checkIn, date) ?? null;
      const checkOut = resolveTime(entry.checkOut, date) ?? null;

      const timeErrors = validateTimes({ checkIn, checkOut, breakStart: null, breakEnd: null });
      if (timeErrors) {
        return err("Validation failed", 422, {
          entries: [`Worker ${entry.workerId}: ${Object.values(timeErrors).flat().join("; ")}`],
        });
      }

      resolved.push({
        workerId: entry.workerId,
        branchId,
        status: entry.status ?? input.status,
        checkIn,
        checkOut,
        notes: entry.notes ?? input.notes ?? null,
      });
    }

    const contexts = await loadAttendanceContexts(
      prisma,
      resolved.map((r) => ({ workerId: r.workerId, branchId: r.branchId, date }))
    );

    // `isLocked: true` is load-bearing. Without it this matches every worker who
    // merely HAS a row for the date, and a bulk mark would silently skip everyone
    // already marked while reporting them as "locked".
    const locked = await prisma.attendance.findMany({
      where: { workerId: { in: workerIds }, date, isLocked: true },
      select: { workerId: true },
    });
    const lockedSet = new Set(locked.map((l) => l.workerId));

    // Preserve first-authorship on rows that already exist.
    const priorRows = await prisma.attendance.findMany({
      where: { workerId: { in: workerIds }, date },
      select: { workerId: true, manualCreatedBy: true, manualCreatedAt: true },
    });
    const priorMap = new Map(priorRows.map((r) => [r.workerId, r]));
    const stampedAt = new Date();

    const skipped: string[] = [];

    const results = await prisma.$transaction(
      resolved
        .filter((entry) => {
          if (lockedSet.has(entry.workerId) && !caps.canOverrideLock) {
            skipped.push(entry.workerId);
            return false;
          }
          return true;
        })
        .map((entry) => {
          const context =
            contexts.get(`${entry.workerId}|${formatDateKey(date)}`) ?? {
              shiftId: null, shift: null, shiftName: null, isHoliday: false, isOnLeave: false,
            };

          const times = {
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            breakStart: null,
            breakEnd: null,
          };
          const fields = buildRecordFields(date, times, context, entry.status ?? null);

          const prior = priorMap.get(entry.workerId);
          // Bulk marking is always human-authored, so every row it writes carries
          // the manual flag, the shared reason, and a pending approval state.
          const manualFields = {
            isManual: true,
            manualReason: input.reason,
            manualCreatedBy: prior?.manualCreatedBy ?? user.userId,
            manualCreatedAt: prior?.manualCreatedAt ?? stampedAt,
            approvedBy: null,
            approvedAt: null,
          };

          return prisma.attendance.upsert({
            where: { workerId_date: { workerId: entry.workerId, date } },
            update: {
              ...times, ...fields, ...manualFields, notes: entry.notes,
              markedBy: user.userId,
            },
            create: {
              workerId: entry.workerId,
              branchId: entry.branchId,
              date,
              ...times,
              ...fields,
              ...manualFields,
              notes: entry.notes,
              markedBy: user.userId,
            },
            select: { id: true, workerId: true, status: true },
          });
        })
    );

    await writeAudit(user, {
      action: "BULK_UPDATE",
      module: MODULE,
      refId: null,
      refType: "Attendance",
      newValue: {
        date: formatDateKey(date),
        marked: results.length,
        skippedLocked: skipped,
      },
    });

    return created(
      { date: formatDateKey(date), marked: results.length, skippedLocked: skipped, results },
      skipped.length > 0
        ? `Marked ${results.length} worker(s); ${skipped.length} skipped (locked)`
        : `Marked ${results.length} worker(s)`
    );
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// SUMMARY — dashboard cards
// ============================================================================

/**
 * GET — the headline numbers for one date (default today).
 *
 * `notMarked` is the honest gap: active workers in scope minus workers with a row.
 * A dashboard that only counted existing rows would report a perfect day for a
 * branch where nobody had been marked at all.
 */
export async function attendanceSummary(req: NextRequest, roles: UserType[]) {
  const { scope, error } = await guard(req, roles, true);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const filters = parseAttendanceFilters(url);
    const date = filters.from ?? attendanceDateKey();

    const dayWhere: Prisma.AttendanceWhereInput = {
      ...buildAttendanceWhere({ ...filters, from: date, to: date }, scope),
    };

    const [rows, activeWorkers] = await Promise.all([
      prisma.attendance.findMany({ where: dayWhere, select: ATTENDANCE_METRIC_SELECT }),
      prisma.workerProfile.count({ where: { isActive: true, ...workerBranchWhere(scope) } }),
    ]);

    const summary = summarizeAttendance(rows);

    return ok({
      date: formatDateKey(date),
      ...summary,
      activeWorkers,
      // Never negative: a worker can hold a row after being deactivated.
      notMarked: Math.max(0, activeWorkers - summary.total),
      working: summary.checkedIn,
    });
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// WORKER SELF-SERVICE
//
// A worker's authority over attendance is different in KIND, not degree: they may
// always clock THEMSELVES and never anybody else. That is why these do not consult
// capabilitiesFor() (every worker capability is false) — but they still run the
// same state machine, the same validation and the same engine as the front desk,
// through applyClock().
// ============================================================================

/** Resolve the caller's workerProfile id, falling back to a lookup by userId. */
async function resolveOwnWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const profile = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/** The worker list select — ATTENDANCE_SELECT plus the two scalar ids the original route returned. */
const WORKER_ATTENDANCE_SELECT = {
  ...ATTENDANCE_SELECT,
  workerId: true,
  branchId: true,
} satisfies Prisma.AttendanceSelect;

/**
 * GET /api/v1/worker/attendance — the caller's own log.
 *
 * Preserves the original wire contract exactly: same `paginated()` envelope, same
 * `?from` / `?to` / `?page` / `?limit` params, same `date desc` ordering. The rows
 * are strictly RICHER than before (branch, shift and every derived metric are now
 * populated instead of sitting at zero), so nothing that read the old shape breaks.
 */
export async function listWorkerAttendance(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveOwnWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const filters = parseAttendanceFilters(url);

    const where: Prisma.AttendanceWhereInput = {
      workerId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: "desc" }],
        select: WORKER_ATTENDANCE_SELECT,
      }),
      prisma.attendance.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

/**
 * POST /api/v1/worker/attendance — clock in / out / break for oneself.
 *
 * Original contract preserved: `{ action: "CHECK_IN" | "CHECK_OUT" | "BREAK_START"
 * | "BREAK_END" }` and a 201 on success. What is new is that illegal transitions
 * now answer 409 ("Already checked in for today") instead of silently overwriting
 * the earlier timestamp, and every metric is computed on the way in.
 */
export async function workerClockAction(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  const parsed = validate(ClockSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  try {
    const workerId = await resolveOwnWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    return await applyClock({
      workerId,
      action: parsed.data.action,
      // A worker never backdates their own clock — the server's clock is the record.
      at: undefined,
      actor: user,
      markedBy: null,
      canOverrideLock: false,
      preferredBranchId: null,
    });
  } catch {
    return err("Internal server error", 500);
  }
}

/**
 * GET /api/v1/worker/attendance/summary — the caller's own month.
 *
 * Totals come from `summarizeAttendance()`, the same function behind the admin
 * dashboard, so a worker and their manager always see the same hours.
 */
export async function workerAttendanceSummary(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveOwnWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const monthRaw = url.searchParams.get("month")?.trim();

    let anchor = attendanceDateKey();
    if (monthRaw) {
      if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
        return err("Validation failed", 422, { month: ["Must be YYYY-MM"] });
      }
      const parsedMonth = parseDateKey(`${monthRaw}-01`);
      if (!parsedMonth) return err("Validation failed", 422, { month: ["Invalid month"] });
      anchor = parsedMonth;
    }

    const { start, end } = monthBounds(anchor);
    const today = attendanceDateKey();

    const [rows, todayRecord] = await Promise.all([
      prisma.attendance.findMany({
        where: { workerId, date: { gte: start, lte: end } },
        select: ATTENDANCE_METRIC_SELECT,
      }),
      prisma.attendance.findUnique({
        where: { workerId_date: { workerId, date: today } },
        select: ATTENDANCE_SELECT,
      }),
    ]);

    return ok({
      month: formatDateKey(start).slice(0, 7),
      range: { from: formatDateKey(start), to: formatDateKey(end) },
      summary: summarizeAttendance(rows),
      today: todayRecord,
    });
  } catch {
    return err("Internal server error", 500);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Dates are not valid JSON for Prisma's Json columns — flatten before auditing. */
function serialize(value: Record<string, unknown>): Prisma.InputJsonValue {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, raw] of Object.entries(value)) {
    if (raw instanceof Date) out[key] = raw.toISOString();
    else if (raw === null || raw === undefined) out[key] = null;
    else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      out[key] = raw;
    } else out[key] = String(raw);
  }

  return out;
}
