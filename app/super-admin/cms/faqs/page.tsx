import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: CMS — FAQs

export default async function SuperAdminCmsFaqsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const faqs = await prisma.faq.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });

  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, f) => {
    const key = f.category ?? "General";
    acc[key] = [...(acc[key] ?? []), f];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">FAQs</h1>
        <p className="mt-0.5 text-sm text-gray-500">{faqs.length} total · {faqs.filter((f) => f.isActive).length} active</p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">{category}</span>
              <Badge tone="neutral">{items.length}</Badge>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-50">
            {items.map((f) => (
              <div key={f.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{f.question}</p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{f.answer}</p>
                  </div>
                  <Badge tone={f.isActive ? "success" : "neutral"}>{f.isActive ? "Active" : "Off"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {faqs.length === 0 && (
        <Card><p className="px-4 py-8 text-center text-sm text-gray-400">No FAQs yet.</p></Card>
      )}
    </div>
  );
}
