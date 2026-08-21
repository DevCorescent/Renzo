/* ── booking date helpers ─────────────────────────────────────────────────────
   Every date on the wire is a bare `YYYY-MM-DD` calendar day, not an instant.
   These helpers therefore build and read Date objects in LOCAL time.

   The wizard previously used `new Date().toISOString().slice(0, 10)`, which is
   the UTC day: between midnight and 05:30 IST that is still *yesterday*, so
   "Today" pointed at a past date and the slot API returned nothing. Parsing
   `new Date("2026-08-21")` has the mirror problem — it yields UTC midnight,
   which is the previous calendar day for any negative UTC offset.
── ─────────────────────────────────────────────────────────────────────────── */

/** Local calendar day of a Date, as `YYYY-MM-DD`. */
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` → local midnight of that day. */
export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISODate(new Date());
}

export function addDays(base: string, n: number) {
  const d = parseISODate(base);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string) {
  const d = parseISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function isoMonthLabel(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** "Friday, 21 August 2026" */
export function fmtDate(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Fri, 21 Aug" — the compact form used in the selection chips. */
export function fmtDateShort(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
