import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { PortfolioRequests } from "@/components/worker-portfolio/portfolio-requests";

// OWNER: Gauransh | MODULE: Worker — Portfolio Requests
//
// The worker's approval-workflow tracker. A thin server shell: it only guards the
// route to a signed-in WORKER, then hands off to the client, which does all the
// work through the existing /api/v1/worker/portfolio-requests endpoint (never
// Prisma). Additive — the showcase and manage pages are untouched.

export default async function PortfolioRequestsPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");

  return <PortfolioRequests />;
}
