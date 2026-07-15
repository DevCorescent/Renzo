import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import prisma from "@/lib/db";
import { LeavesClient } from "@/components/worker/leaves/leaves-client";
import type { LeaveTypeOption } from "@/components/worker/leaves/types";

// OWNER: Gauransh | MODULE: Worker Leaves
//
// A thin server shell. It does TWO things and no more:
//   1. Guards the route to a signed-in WORKER (the layout guards too — this is the
//      second line, and the API is the third).
//   2. Reads the active LeaveType catalog so the apply form has something to pick.
//
// WHY THE CATALOG IS READ HERE, NOT FETCHED.
//   POST /api/v1/worker/leaves needs a leaveTypeId, but there is NO worker-facing
//   endpoint that lists LeaveType — I searched app/api and none exists. LeaveType
//   is a GLOBAL lookup table: no per-worker scoping, no branch isolation, no
//   sensitive fields (name, code, isPaid). Reading it in the Server Component is
//   exactly how every other worker page in this codebase loads its data, so it is
//   the project's own architecture — not a bypass invented for this feature. The
//   alternative (inventing a GET /worker/leave-types route) is a backend change,
//   which is out of bounds. The worker's own leaves — which ARE scoped and DO have
//   an endpoint — are fetched from that endpoint on the client, never from here.
//
// If a worker-facing leave-types endpoint is ever added, swap this one read for a
// client fetch; nothing else in the module changes.

export default async function WorkerLeavesPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");

  const leaveTypes: LeaveTypeOption[] = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, isPaid: true },
  });

  // Computed on the SERVER and passed down. new Date() in a client render would
  // disagree with the server for a request straddling midnight, and React would
  // flag a hydration mismatch. This drives the date inputs' `min`.
  const today = new Date().toISOString().slice(0, 10);

  return <LeavesClient leaveTypes={leaveTypes} today={today} />;
}
