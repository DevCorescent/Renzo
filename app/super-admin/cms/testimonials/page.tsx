import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: CMS — Testimonials

export default async function SuperAdminCmsTestimonialsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const testimonials = await prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Testimonials</h1>
        <p className="mt-0.5 text-sm text-gray-500">{testimonials.length} total · {testimonials.filter((t) => t.isApproved).length} approved</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All Testimonials</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Rating</TH><TH>Comment</TH><TH>Status</TH></tr></THead>
          <tbody>
            {testimonials.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No testimonials.</td></tr>
            ) : (
              testimonials.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium text-gray-900">
                    {t.customerName}
                    {t.designation && <p className="text-[11px] text-gray-400">{t.designation}</p>}
                  </TD>
                  <TD className="text-gray-700">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</TD>
                  <TD className="max-w-[250px] truncate text-xs text-gray-500">{t.comment}</TD>
                  <TD><Badge tone={t.isApproved ? "success" : "warning"}>{t.isApproved ? "Approved" : "Pending"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
