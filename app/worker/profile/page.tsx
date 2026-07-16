import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { getWorkerWorkspace } from "@/lib/worker-workspace";
import { WorkerProfileView } from "@/components/worker-workspace/worker-profile-view";

// OWNER: Hemant | MODULE: Worker — Profile
//
// The worker's own profile now uses the SAME enhanced profile the admin sees:
// identity hero, headline KPIs, recent work, portfolio, services, and the
// Profile Information rail. Data comes from the shared getWorkerWorkspace fetch —
// self-view bypasses the branch gate (a worker may always see their own record).
// Read-only: there is no worker self-edit API.

export default async function WorkerProfilePage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");

  const data = await getWorkerWorkspace(authUser.workerId, authUser);
  if (!data) notFound();

  return <WorkerProfileView data={data} />;
}
