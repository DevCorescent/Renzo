// ============================================================================
// MODULE : Branch open/closed state — "Open now" / "Closed · opens 9:00 AM"
//
// WHY IT LIVES HERE
// -----------------
// The customer-facing badge must agree with what the booking engine will
// actually allow, so the rule ("today's BranchTiming row, unless a holiday")
// is written once and imported by any surface that needs it.
//
// TIME ZONE
// ---------
// A salon is open in ITS OWN local time, not the visitor's. Reading the
// browser clock would tell a customer in London that a Bengaluru salon is shut,
// and plain UTC (what lib/slots.ts uses) is 5h30m off for every Indian branch.
// Everything here resolves "now" in SALON_TIME_ZONE via Intl, so the answer is
// identical on the server, on the client, and in any visitor's time zone.
// ============================================================================

export const SALON_TIME_ZONE = "Asia/Kolkata";

export type DayTiming = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  isOpen: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "21:00"
};

export type OpenState = {
  /**
   * UNKNOWN = this branch has no hours configured at all. Kept separate from
   * CLOSED so admin surfaces can tell "nothing configured" from "shut today",
   * but it reads as Closed to customers — see `label`.
   */
  status: "OPEN" | "CLOSED" | "UNKNOWN";
  /** Pill text: "Open now" | "Closed". */
  label: string;
  /** Optional qualifier: "until 5:00 PM", "opens 9:00 AM", "opens Fri 9:00 AM". */
  detail: string | null;
};

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SALON_TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23", // 00–23; h12/hour12:false can hand back "24" at midnight
});

/** "Now" as the salon experiences it: its weekday, minutes since its midnight, and its calendar date. */
export function salonNow(now: Date = new Date()): {
  dayOfWeek: number;
  minutes: number;
  dateKey: string; // "YYYY-MM-DD" in salon time
} {
  const parts = partsFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    dayOfWeek: DAY_INDEX[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** The UTC-midnight Date that BranchHoliday.date (@db.Date) stores for today in salon time. */
export function salonTodayAsUtcDate(now: Date = new Date()): Date {
  return new Date(`${salonNow(now).dateKey}T00:00:00.000Z`);
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/** "17:00" → "5:00 PM" — customers read the public site, not a 24-hour roster. */
export function formatTime12(t: string): string {
  const mins = toMinutes(t);
  if (!Number.isFinite(mins)) return t;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const usable = (t: DayTiming | undefined): t is DayTiming =>
  !!t && t.isOpen && Number.isFinite(toMinutes(t.openTime)) && Number.isFinite(toMinutes(t.closeTime)) &&
  toMinutes(t.closeTime) > toMinutes(t.openTime);

/**
 * Is the branch open right now?
 *
 * @param timings     the branch's saved week (any subset of 7 days)
 * @param isHolidayToday whether today is a BranchHoliday — a holiday shuts the
 *                    day regardless of the weekly schedule, matching lib/slots.ts
 *
 * A day with no saved row counts as closed, which is exactly how the slot engine
 * reads it. A branch with NO rows at all is Closed too (status UNKNOWN): claiming
 * "Open now" for a branch that cannot produce a single bookable slot is the worst
 * possible answer.
 */
export function resolveOpenState(
  timings: DayTiming[] | null | undefined,
  isHolidayToday = false,
  now: Date = new Date()
): OpenState {
  // No schedule at all — the slot engine cannot produce a single bookable time,
  // so the honest customer-facing answer is Closed.
  if (!timings || timings.length === 0) {
    return { status: "UNKNOWN", label: "Closed", detail: null };
  }

  const { dayOfWeek, minutes } = salonNow(now);
  const byDay = new Map(timings.map((t) => [t.dayOfWeek, t]));
  const today = byDay.get(dayOfWeek);

  // Next opening, scanned from tomorrow forward, so a closed day still tells the
  // customer when to come back.
  const nextOpening = (): string | null => {
    for (let offset = 1; offset <= 7; offset++) {
      const day = (dayOfWeek + offset) % 7;
      const t = byDay.get(day);
      if (!usable(t)) continue;
      const when = offset === 1 ? "tomorrow" : DAY_SHORT[day];
      return `opens ${when} ${formatTime12(t.openTime)}`;
    }
    return null;
  };

  if (isHolidayToday) {
    return { status: "CLOSED", label: "Closed", detail: nextOpening() ?? "holiday" };
  }

  if (!usable(today)) {
    return { status: "CLOSED", label: "Closed", detail: nextOpening() };
  }

  const open = toMinutes(today.openTime);
  const close = toMinutes(today.closeTime);

  if (minutes < open) {
    return { status: "CLOSED", label: "Closed", detail: `opens ${formatTime12(today.openTime)}` };
  }
  if (minutes >= close) {
    return { status: "CLOSED", label: "Closed", detail: nextOpening() };
  }
  return { status: "OPEN", label: "Open now", detail: `until ${formatTime12(today.closeTime)}` };
}
