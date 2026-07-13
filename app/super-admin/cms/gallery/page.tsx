import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: CMS — Gallery

export default async function SuperAdminCmsGalleryPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const items = await prisma.gallery.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const grouped = items.reduce<Record<string, typeof items>>((acc, g) => {
    acc[g.category] = [...(acc[g.category] ?? []), g];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Gallery</h1>
        <p className="mt-0.5 text-sm text-gray-500">{items.length} items across {Object.keys(grouped).length} categories</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All Gallery Items</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Title</TH><TH>Category</TH><TH>Sort</TH><TH>Status</TH></tr></THead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No gallery items.</td></tr>
            ) : (
              items.map((g) => (
                <TR key={g.id}>
                  <TD className="text-gray-700">{g.title ?? "Untitled"}</TD>
                  <TD><Badge tone="neutral">{g.category}</Badge></TD>
                  <TD className="text-gray-400">{g.sortOrder}</TD>
                  <TD><Badge tone={g.isActive ? "success" : "neutral"}>{g.isActive ? "Active" : "Off"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
