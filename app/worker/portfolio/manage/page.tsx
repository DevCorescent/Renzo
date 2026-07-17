import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { PortfolioManager } from "@/components/worker-portfolio/portfolio-manager";

// OWNER: Gauransh | MODULE: Worker — Portfolio management
//
// The worker's own gallery manager. A thin server shell: it only guards the route
// to a signed-in WORKER, then hands off to the client manager, which does all the
// work through the existing /api/v1/worker/portfolio endpoints (never Prisma).
// This is additive — the read-only showcase at /worker/portfolio is untouched.

export default async function ManagePortfolioPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");

  return <PortfolioManager />;
}
