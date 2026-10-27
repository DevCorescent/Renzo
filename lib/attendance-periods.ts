// ============================================================================
// MODULE : Attendance — period presets ("This month", "Last month", …)
//
// The attendance and lunch-break views open on the CURRENT CALENDAR MONTH — on
// 1 October that is 1–31 October, never "the last 30 days", which would be mostly
// September. Presets and the ‹ › month stepper let an admin look back on purpose.
//
// Pure "YYYY-MM-DD" arithmetic (date-only values, computed in UTC so no time
// zone can shift a day). "Today" is passed in by the caller from the salon's
// (IST) calendar day — attendanceDateKey() on the server, todayKey() in the
// browser — so a page and its picker can never disagree about the month.
// No imports: safe in client and server bundles.
// ============================================================================

export type AttendancePeriod = "this-month" | "last-month" | "this-week" | "today";

export type DateRange = { from: string; to: string };

export const ATTENDANCE_PERIODS: { value: AttendancePeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-week", label: "This week" },
  { value: "today", label: "Today" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function toUtc(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 1st → last day of the month `value` falls in. */
export function monthRange(value: string): DateRange {
  const d = toUtc(value);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return { from: ymd(new Date(Date.UTC(y, m, 1))), to: ymd(new Date(Date.UTC(y, m + 1, 0))) };
}

/** The whole month `delta` months away from the month `value` falls in. */
export function shiftMonth(value: string, delta: number): DateRange {
  const d = toUtc(value);
  return monthRange(ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1))));
}

/** Monday → Sunday, as weekBounds() in lib/attendance-service.ts. */
export function weekRange(value: string): DateRange {
  const d = toUtc(value);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - sinceMonday * 86_400_000);
  return { from: ymd(monday), to: ymd(new Date(monday.getTime() + 6 * 86_400_000)) };
}

export function presetRange(period: AttendancePeriod, today: string): DateRange {
  switch (period) {
    case "this-month": return monthRange(today);
    case "last-month": return shiftMonth(today, -1);
    case "this-week": return weekRange(today);
    case "today": return { from: today, to: today };
  }
}

/** The default view: the current calendar month. */
export function defaultAttendanceRange(today: string): DateRange {
  return monthRange(today);
}

/** Which preset a from/to pair is, if any (no dates at all = the default month). */
export function matchPeriod(from: string | null, to: string | null, today: string): AttendancePeriod | null {
  if (!from && !to) return "this-month";
  return ATTENDANCE_PERIODS.find(({ value }) => {
    const r = presetRange(value, today);
    return r.from === from && r.to === to;
  })?.value ?? null;
}

/** True when the range is exactly one calendar month. */
export function isWholeMonth(range: DateRange): boolean {
  const m = monthRange(range.from);
  return m.from === range.from && m.to === range.to;
}

/** "October 2026", "2 Oct 2026", or "1 Oct – 15 Oct 2026". */
export function rangeLabel(range: DateRange): string {
  const a = toUtc(range.from);
  const b = toUtc(range.to);
  if (isWholeMonth(range)) return `${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  const day = (d: Date, withYear: boolean) =>
    `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  if (range.from === range.to) return day(a, true);
  return `${day(a, a.getUTCFullYear() !== b.getUTCFullYear())} – ${day(b, true)}`;
}
