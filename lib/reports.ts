// OWNER: Shalmon | MODULE: Reports — shared date helpers

// Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD, defaulting to the last N days.
export function parseDateRange(url: URL, defaultDays = 30): { from: Date; to: Date } {
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const to = toStr && !isNaN(Date.parse(toStr)) ? new Date(toStr) : new Date();
  const from =
    fromStr && !isNaN(Date.parse(fromStr))
      ? new Date(fromStr)
      : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

// Bucket a date into a day / ISO-week (Monday) / month label.
export function bucketKey(d: Date, groupBy: string): string {
  const iso = d.toISOString();
  if (groupBy === "month") return iso.slice(0, 7); // YYYY-MM
  if (groupBy === "week") {
    const offset = (d.getUTCDay() + 6) % 7; // days since Monday
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - offset);
    return monday.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10); // YYYY-MM-DD
}
