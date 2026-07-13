import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { ServiceImageUpload } from "./service-image-upload";

// OWNER: Hemant | MODULE: Super Admin — Services

export default async function SuperAdminServicesPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { services: true } } },
    }),
    prisma.service.findMany({
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        image: true,
        basePrice: true,
        duration: true,
        gender: true,
        isPopular: true,
        isActive: true,
        category: { select: { name: true } },
        _count: { select: { variants: true, workerServices: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Services</h1>
        <p className="mt-0.5 text-sm text-gray-500">{services.length} services across {categories.length} categories</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <div key={c.id} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-800">{c.name}</p>
            <p className="mt-1 text-xs text-gray-400">
              {c._count.services} service{c._count.services !== 1 ? "s" : ""} ·{" "}
              <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Active" : "Off"}</Badge>
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Services</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Photo</TH>
              <TH>Name</TH>
              <TH>Category</TH>
              <TH>Base Price</TH>
              <TH>Duration</TH>
              <TH>Gender</TH>
              <TH>Variants</TH>
              <TH>Workers</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No services yet.</td></tr>
            ) : (
              services.map((s) => (
                <TR key={s.id}>
                  <TD><ServiceImageUpload serviceId={s.id} currentImage={s.image ?? null} /></TD>
                  <TD className="font-medium text-gray-900">
                    {s.name}
                    {s.isPopular && <span className="ml-1 text-[10px] text-yellow-600">★ Popular</span>}
                  </TD>
                  <TD className="text-gray-500">{s.category.name}</TD>
                  <TD className="text-gray-700">₹{Number(s.basePrice).toLocaleString("en-IN")}</TD>
                  <TD className="text-gray-500">{s.duration} min</TD>
                  <TD className="text-gray-500 capitalize">{s.gender.toLowerCase()}</TD>
                  <TD className="text-gray-500">{s._count.variants}</TD>
                  <TD className="text-gray-500">{s._count.workerServices}</TD>
                  <TD><Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
