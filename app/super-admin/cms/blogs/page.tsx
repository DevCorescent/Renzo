import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: CMS — Blogs

export default async function SuperAdminCmsBlogsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const blogs = await prisma.blog.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Blogs</h1>
        <p className="mt-0.5 text-sm text-gray-500">{blogs.length} total · {blogs.filter((b) => b.isPublished).length} published</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All Blogs</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Title</TH><TH>Category</TH><TH>Author</TH><TH>Published</TH><TH>Status</TH></tr></THead>
          <tbody>
            {blogs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No blogs yet.</td></tr>
            ) : (
              blogs.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium text-gray-900">{b.title}</TD>
                  <TD className="text-gray-500">{b.category ?? "—"}</TD>
                  <TD className="text-gray-500">{b.author ?? "—"}</TD>
                  <TD className="font-mono text-xs text-gray-500">{b.publishedAt ? new Date(b.publishedAt).toLocaleDateString("en-IN") : "—"}</TD>
                  <TD><Badge tone={b.isPublished ? "success" : "neutral"}>{b.isPublished ? "Published" : "Draft"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
