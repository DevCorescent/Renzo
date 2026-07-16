// OWNER: Gauransh
// MODULE: Super Admin Leave Management

import * as React from "react";
import { Clock3, CheckCircle2, XCircle, CalendarPlus, UserMinus, Ban, Layers } from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import type { LeaveStats } from "@/components/branch-leaves/types";

// Organization-wide leave overview, straight from GET /api/v1/admin/leaves/stats —
// never derived from the current page of cards, so the numbers stay true while the
// list is filtered. `today` / `onLeaveToday` come from the same route (added
// additively). "Staff on leave" is deliberately absent: the schema stores worker
// leaves only, and inventing a staff figure would be fake data.
export function SuperLeaveStatsCards({ stats }: { stats: LeaveStats }) {
  const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-IN");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatCard label="Pending" value={n(stats.pending)} icon={Clock3} />
      <StatCard label="Approved" value={n(stats.approved)} icon={CheckCircle2} />
      <StatCard label="Rejected" value={n(stats.rejected)} icon={XCircle} />
      <StatCard label="Today's requests" value={n(stats.today)} icon={CalendarPlus} />
      <StatCard label="Workers on leave" value={n(stats.onLeaveToday)} icon={UserMinus} />
      <StatCard label="Cancelled" value={n(stats.cancelled)} icon={Ban} />
      <StatCard label="Total requests" value={n(stats.total)} icon={Layers} />
    </div>
  );
}
