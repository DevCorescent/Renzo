import { getServerUser, requireModule } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle } from "@/components/shared/ui";
import { BranchTimingsEditor } from "@/components/shared/branch-timings-editor";

// MODULE: Branch Admin — Operating Hours
// The branch comes from the JWT, never from the URL, so a branch admin can only
// ever edit their own hours (the API enforces the same scope again on write).

export default async function BranchAdminTimingsPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  await requireModule("timings");

  const branch = await prisma.branch.findUnique({
    where: { id: authUser.branchId },
    select: {
      id: true,
      name: true,
      timings: {
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, openTime: true, closeTime: true, isOpen: true, slotDuration: true },
      },
    },
  });

  if (!branch) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-(--sa-text)">Operating Hours</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-(--sa-muted)">
          Weekly opening hours for {branch.name}. These decide which time slots customers can book.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Weekly schedule</CardTitle></CardHeader>
        <BranchTimingsEditor branchId={branch.id} initial={branch.timings} />
      </Card>
    </div>
  );
}
